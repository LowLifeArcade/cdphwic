import type { RequestRecord } from '../../../shared/domain';
import { resolveShipmentFormula } from '../../../shared/shipmentFormulas';
import {
    confirmSimpleShipmentReceipt,
    type SimpleShipmentReceiptCommand,
} from '../../../shared/simpleShipmentReceipts';
import { transferReceiptSteps } from '../../utils/requestTransferInventory';
import { getProduct, listProducts } from '../../utils/productRepository';
import { transferCatalogUnitsPerCase } from '../../../shared/requestTransfers';
import { validUnitSize } from '../../../shared/shipmentQuantities';
import {
    confirmShipmentReceipts,
    shipmentReceiptKey,
    type ShipmentReceiptSelection,
} from '../../../shared/shipmentReceipts';
import { originalCaseApproval } from '../../../shared/shipmentCaseTracking';
import { applyShipmentIssue, type ShipmentIssueCommand } from '../../../shared/shipmentIssues';
import { shipmentDispatched } from '../../../shared/shipmentReceipts';
import { requestShipments } from '../../../shared/requestShipments';
import { splitOrderFulfillmentComplete } from '../../../shared/fulfillmentAllocations';
import { nextRecord, writeRecord } from './persistence';

export async function updateSubmittedShipmentReceipt(
    db: D1Database,
    previous: RequestRecord,
    selections: ShipmentReceiptSelection[],
    actorId: number,
) {
    const prepared = await prepareCatalogReceiptPackaging(db, previous, selections);
    let updates = {
        ...confirmShipmentReceipts(prepared.request, prepared.selections, actorId),
        ...(originalCaseApproval(previous) !== undefined
            ? {
                  originalApprovedCases: originalCaseApproval(previous),
              }
            : {}),
    };
    updates = keepSplitFulfillmentOpen(previous, updates);
    return writeRecord(
        db,
        previous,
        nextRecord(previous, updates),
        false,
        await transferReceiptSteps(db, previous, updates),
    );
}

export async function updateSubmittedShipmentIssue(
    db: D1Database,
    previous: RequestRecord,
    command: ShipmentIssueCommand,
    actorId: number,
    senderType?: 'agency' | 'reviewer',
) {
    const original = previous;
    if (command.action === 'resolve-received' && command.catalogUnitsPerCase !== undefined) {
        const prepared = await prepareCatalogReceiptPackaging(db, previous, [command]);
        previous = prepared.request;
        command = {
            ...command,
            key: prepared.selections[0]!.key,
        };
    }
    const updates = {
        ...applyShipmentIssue(previous, command, actorId, undefined, senderType),
        ...(originalCaseApproval(previous) !== undefined
            ? {
                  originalApprovedCases: originalCaseApproval(previous),
              }
            : {}),
    };
    return writeRecord(
        db,
        original,
        nextRecord(original, updates),
        false,
        await transferReceiptSteps(db, original, updates),
    );
}

export async function shipmentCatalogPackaging(
    db: D1Database,
    request: RequestRecord,
    row: NonNullable<RequestRecord['shipments']>[number],
) {
    const formula = row.shipmentFormula ?? resolveShipmentFormula(request, row);
    const matched = formula
        ? transferCatalogUnitsPerCase(
              {
                  formulaName: formula.productName,
                  form: formula.productForm ?? '',
                  flavor: formula.flavor,
              },
              await listProducts(db, {
                  includeInactive: true,
              }),
          )
        : undefined;
    if (validUnitSize(matched)) {
        return matched;
    }
    if ((request.requestedFormulas?.length ?? 1) <= 1 && request.productId) {
        try {
            return (await getProduct(db, request.productId)).unitsPerCase;
        } catch {}
    }
    return undefined;
}

async function prepareCatalogReceiptPackaging(
    db: D1Database,
    previous: RequestRecord,
    selections: ShipmentReceiptSelection[],
) {
    const rows = requestShipments(previous);
    let changed = false;
    const fail = (): never => {
        throw Object.assign(
            new Error(
                'Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.',
            ),
            {
                statusCode: 409,
                statusMessage:
                    'Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.',
            },
        );
    };
    const normalized = await Promise.all(
        selections.map(async (selection) => {
            if (selection.catalogUnitsPerCase === undefined) {
                return selection;
            }
            const row = rows[selection.index];
            if (!row || shipmentReceiptKey(row) !== selection.key || validUnitSize(row.unitsPerCase)) {
                fail();
            }
            const size = await shipmentCatalogPackaging(db, previous, row!);
            if (!validUnitSize(size) || size !== selection.catalogUnitsPerCase) {
                fail();
            }
            rows[selection.index] = {
                ...row!,
                unitsPerCase: size,
            };
            changed = true;
            return {
                ...selection,
                key: shipmentReceiptKey(rows[selection.index]!),
            };
        }),
    );
    return {
        request: changed
            ? {
                  ...previous,
                  shipments: rows,
              }
            : previous,
        selections: normalized,
    };
}

export async function updateSubmittedSimpleShipmentReceipt(
    db: D1Database,
    previous: RequestRecord,
    command: SimpleShipmentReceiptCommand,
    actorId: number,
) {
    const updates = keepSplitFulfillmentOpen(previous, confirmSimpleShipmentReceipt(previous, command, actorId));
    return writeRecord(
        db,
        previous,
        nextRecord(previous, updates),
        false,
        await transferReceiptSteps(db, previous, updates),
    );
}

export function keepSplitFulfillmentOpen<T extends Partial<RequestRecord>>(
    previous: RequestRecord,
    updates: T,
): T | (T & Partial<RequestRecord>) {
    const merged = {
        ...previous,
        ...updates,
    };
    if (updates.status === 'complete' && !splitOrderFulfillmentComplete(merged)) {
        const rows = requestShipments(merged);
        return {
            ...updates,
            status: rows.every((row) => shipmentDispatched(merged, row)) ? 'shipped' : 'in_progress',
            receivedStatus: 'shipped',
        };
    }
    return updates;
}
