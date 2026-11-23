import type { RequestRecord } from '../../../shared/domain';
import { cancelTransferInventory } from '../../utils/requestTransferInventory';
import { applyShipmentDeletion } from '../../../shared/shipmentDeletion';
import { applyShipmentPolicy, type ShipmentPolicyCommand } from '../../../shared/shipmentPolicy';
import { applyShipmentCaseCommand, type ShipmentCaseCommand } from '../../../shared/shipmentCaseTracking';
import { requestShipments } from '../../../shared/requestShipments';
import { nextRecord, writeRecord } from './persistence';
import { keepSplitFulfillmentOpen } from './shipmentReceipts';

export async function deleteSubmittedShipment(db: D1Database, previous: RequestRecord, index: number, actorId: number) {
    const row = previous.shipments?.[index];
    const steps = row ? await cancelTransferInventory(db, previous, row, actorId) : [];
    return writeRecord(
        db,
        previous,
        nextRecord(previous, applyShipmentDeletion(previous, index, actorId)),
        false,
        steps,
    );
}

export async function updateSubmittedShipmentCases(
    db: D1Database,
    previous: RequestRecord,
    command: ShipmentCaseCommand,
    actorId: number,
) {
    let updates = applyShipmentCaseCommand(previous, command, actorId);
    updates = keepSplitFulfillmentOpen(previous, updates);
    if (command.action === 'replacement' && previous.shipmentDrafts && updates.shipments) {
        const originalCount = requestShipments(previous).length;
        updates.shipmentDrafts = [
            ...previous.shipmentDrafts.slice(0, originalCount),
            ...updates.shipments.slice(originalCount),
            ...previous.shipmentDrafts.slice(originalCount),
        ];
    }
    return writeRecord(db, previous, nextRecord(previous, updates), false);
}

export async function updateSubmittedShipmentPolicy(
    db: D1Database,
    previous: RequestRecord,
    command: ShipmentPolicyCommand,
    actor: number,
) {
    return writeRecord(db, previous, nextRecord(previous, applyShipmentPolicy(previous, command, actor)), false);
}

export async function persistShipmentEvidence(
    db: D1Database,
    previous: RequestRecord,
    index: number,
    expectedIssue: string,
    patch: Partial<NonNullable<NonNullable<RequestRecord['shipments']>[number]['issue']>>,
) {
    const rows = requestShipments(previous);
    const row = rows[index];
    if (!row?.issue || JSON.stringify(row.issue) !== expectedIssue) {
        throw Object.assign(new Error('Issue changed. Refresh before adding evidence.'), {
            statusCode: 409,
            statusMessage: 'Issue changed. Refresh before adding evidence.',
        });
    }
    rows[index] = {
        ...row,
        issue: {
            ...row.issue,
            ...patch,
        },
    };
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            shipments: rows,
        }),
        false,
    );
}
