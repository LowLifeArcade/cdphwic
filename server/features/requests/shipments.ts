import type { RequestRecord } from '../../../shared/domain';
import { resolveSurplusClinic } from '../../utils/surplusClinicLocations';
import { publishAuthorization } from '../../../shared/authorizationPublication';
import { requireShipmentFormula, shipmentFormulaKey } from '../../../shared/shipmentFormulas';
import { transferError } from '../../utils/requestTransferInventory';
import { shipmentPlan } from '../../../shared/shipmentPublishing';
import { getDistributor } from '../../utils/distributors';
import { snapshotDistributor } from '../../../shared/distributors';
import { listProducts } from '../../utils/productRepository';
import { validUnitSize } from '../../../shared/shipmentQuantities';
import { originalCaseApproval } from '../../../shared/shipmentCaseTracking';
import { activeShipmentIssue, shipmentIssueSummary } from '../../../shared/shipmentIssues';
import {
    preserveShipmentReceipts,
    shipmentReceived,
    shipmentFinished,
    shipmentDispatched,
} from '../../../shared/shipmentReceipts';
import { validateBreastfeeding } from '../../../shared/breastfeeding';
import { validateRequestedMonths } from '../../../shared/requestMonthSelection';
import { validateFormulaSelection } from '../../../shared/formulaEntries';
import { requestShipments, shipmentUpdates, validateShipments } from '../../../shared/requestShipments';
import { splitOrderFulfillmentComplete, validateShipmentAllocations } from '../../../shared/fulfillmentAllocations';
import { validateFormulaAuthorizations } from '../../../shared/formulaAuthorizations';
import { conflict, nextRecord, writeRecord } from './persistence';
import { shipmentCatalogPackaging } from './shipmentReceipts';

export async function updateSubmittedRequest(
    db: D1Database,
    previous: RequestRecord,
    updates: Partial<RequestRecord>,
    requireUnopened = false,
    sendEtaShipmentIndex?: number,
    actorId = 0,
    pendingDrafts?: RequestRecord['shipments'],
    quantityTracking = true,
): Promise<RequestRecord> {
    if (updates.formulaAuthorizations !== undefined) {
        const authorizationError = validateFormulaAuthorizations(updates.formulaAuthorizations).at(0);
        if (authorizationError) {
            throw Object.assign(new Error(authorizationError), {
                statusCode: 400,
                statusMessage: authorizationError,
            });
        }
    }
    const proposedShipmentPlans =
        updates.shipmentDrafts ??
        updates.shipments ??
        (updates.formulaAuthorizations !== undefined ? (previous.shipmentDrafts ?? previous.shipments) : undefined);
    if (proposedShipmentPlans) {
        const fulfillmentError = validateShipmentAllocations(
            {
                ...previous,
                ...updates,
                shipments: previous.shipments,
            },
            proposedShipmentPlans,
        );
        if (fulfillmentError) {
            throw Object.assign(new Error(fulfillmentError), {
                statusCode: 400,
                statusMessage: fulfillmentError,
            });
        }
    }
    if (updates.surplusItems !== undefined) {
        for (const [index, item] of updates.surplusItems.entries()) {
            if (item.clinicId !== previous.surplusItems?.[index]?.clinicId) {
                await resolveSurplusClinic(db, previous.agencyId, item.clinicId);
            }
        }
    }
    const incomingPlans = updates.shipmentDrafts ?? updates.shipments;
    for (const [index, row] of (Array.isArray(incomingPlans) ? incomingPlans : []).entries()) {
        if (!row) {
            continue;
        }
        const old = previous.shipments?.[index];
        if (
            old?.shipmentFormula &&
            (old.etaSentAt || old.receivedAt || old.receiptConfirmed || old.issue || old.deletedIssues?.length) &&
            shipmentFormulaKey(row.shipmentFormula) !== shipmentFormulaKey(old.shipmentFormula)
        ) {
            throw conflict('The formula cannot be changed after this shipment has been sent.');
        }
        if (
            row.shipmentFormula &&
            !(
                old?.shipmentFormula &&
                (old.etaSentAt || old.receivedAt || old.receiptConfirmed || old.issue || old.deletedIssues?.length)
            )
        ) {
            requireShipmentFormula(previous, row);
        }
    }
    if (incomingPlans && Array.isArray(incomingPlans)) {
        for (const [index, old] of (previous.shipments ?? []).entries()) {
            if (!old.transferId) {
                continue;
            }
            const row = incomingPlans[index];
            const compared =
                row && updates.shipmentDrafts && old.transferStatus === 'reserved'
                    ? {
                          ...old,
                          ...row,
                          eta: old.eta,
                          carrier: old.carrier,
                          trackingNumbers: old.trackingNumbers,
                      }
                    : row && {
                          ...old,
                          ...row,
                      };
            if (!compared || JSON.stringify(shipmentPlan(compared)) !== JSON.stringify(shipmentPlan(old))) {
                throw transferError('Authorized agency transfers are locked to their reserved quantity and source.');
            }
            if (sendEtaShipmentIndex === index) {
                throw transferError('The sending agency must confirm this transfer shipment.');
            }
        }
    }
    if (updates.shipmentDrafts !== undefined) {
        const drafts = updates.shipmentDrafts;
        const message = !Array.isArray(drafts)
            ? 'Add a Shipment.'
            : validateShipments(
                  drafts.map(
                      (row) =>
                          row && {
                              ...row,
                              etaSentAt: undefined,
                          },
                  ),
              );
        if (message) {
            throw Object.assign(new Error(message), {
                statusCode: 400,
                statusMessage: message,
            });
        }
        const published =
            previous.shipments ?? (previous.eta || previous.trackingNumbers?.length ? requestShipments(previous) : []);
        // Published rows retain stable indexes used by receipt and issue commands.
        if (drafts.length < published.length) {
            throw conflict('Published shipments cannot be removed.');
        }
        const protectedDrafts = preserveShipmentReceipts(
            {
                ...previous,
                shipments: published,
            },
            drafts.map((row, index) =>
                published[index]?.transferId
                    ? {
                          ...published[index]!,
                          ...(published[index]!.transferStatus === 'reserved'
                              ? {
                                    eta: row.eta,
                                    trackingNumbers: [...row.trackingNumbers],
                                }
                              : {}),
                      }
                    : {
                          ...published[index],
                          ...shipmentPlan(row),
                          etaSentAt: published[index]?.etaSentAt,
                          replacementFor: published[index]?.replacementFor,
                      },
            ),
        );
        const {
            shipmentDrafts: _drafts,
            shipments: _rows,
            eta: _eta,
            unitsIssued: _units,
            trackingNumbers: _tracking,
            ...other
        } = updates;
        if (sendEtaShipmentIndex === undefined) {
            return writeRecord(
                db,
                previous,
                nextRecord(previous, {
                    ...other,
                    shipmentDrafts: protectedDrafts,
                }),
                requireUnopened,
            );
        }
        if (
            !Number.isSafeInteger(sendEtaShipmentIndex) ||
            sendEtaShipmentIndex < 0 ||
            sendEtaShipmentIndex >= drafts.length ||
            sendEtaShipmentIndex > published.length
        ) {
            throw conflict('Send the preceding shipment ETA first.');
        }
        const rows = published.map((row) => ({
            ...row,
        }));
        rows[sendEtaShipmentIndex] = protectedDrafts[sendEtaShipmentIndex]!;
        // Reuse authoritative policy, history, validation and atomic revision handling.
        const next = await updateSubmittedRequest(
            db,
            previous,
            {
                ...other,
                shipments: rows,
                shipmentDrafts: undefined,
            },
            requireUnopened,
            sendEtaShipmentIndex,
            actorId,
            protectedDrafts,
            quantityTracking,
        );
        return next;
    }
    if ('breastfeedingStatus' in updates || 'breastfeedingDiscontinuedDate' in updates) {
        const combined = {
            ...previous,
            ...updates,
        };
        const breastfeedingError = validateBreastfeeding(combined);
        if (breastfeedingError) {
            throw Object.assign(new Error(breastfeedingError), {
                statusCode: 400,
                statusMessage: breastfeedingError,
            });
        }
        if (combined.breastfeedingStatus !== 'Discontinued BF') {
            updates.breastfeedingDiscontinuedDate = '';
        }
    }
    if (updates.benefitMonthsRequested !== undefined) {
        if (!Array.isArray(updates.benefitMonthsRequested)) {
            throw Object.assign(new Error('Select up to 3 distinct Benefit Months Requested.'), {
                statusCode: 400,
            });
        }
        const monthError = validateRequestedMonths(updates.benefitMonthsRequested);
        if (monthError) {
            throw Object.assign(new Error(monthError), {
                statusCode: 400,
                statusMessage: monthError,
            });
        }
    }
    if (updates.requestedFormulas !== undefined) {
        if (!Array.isArray(updates.requestedFormulas) || !updates.requestedFormulas.length) {
            throw Object.assign(new Error('Add at least one formula.'), {
                statusCode: 400,
            });
        }
        const formulaError = validateFormulaSelection(
            updates.requestedFormulas.map((formula) => ({
                name: formula.otherFormulaName || formula.productName,
                form: formula.productForm,
                flavor: formula.flavor,
            })),
            await listProducts(db),
        );
        if (formulaError) {
            throw Object.assign(new Error(formulaError), {
                statusCode: 400,
                statusMessage: formulaError,
            });
        }
    }
    if (updates.shipments) {
        updates.shipments = await Promise.all(
            updates.shipments.map(async (row, index) => {
                const old = previous.shipments?.[index];
                const hasHistory =
                    !!old &&
                    (shipmentReceived(previous, old) ||
                        !!old.receiptConfirmed ||
                        !!old.receivedAt ||
                        old.receivedCases !== undefined ||
                        old.receivedUnits !== undefined ||
                        !!old.issue ||
                        !!old.deletedIssues?.length ||
                        !!old.dispositions?.length);
                if (hasHistory && row.distributorId !== old?.distributorId) {
                    throw Object.assign(
                        new Error('The distributor cannot be changed after receipt or issue records exist.'),
                        {
                            statusCode: 409,
                            statusMessage: 'The distributor cannot be changed after receipt or issue records exist.',
                        },
                    );
                }
                if (
                    old &&
                    (hasHistory || ((old.etaSentAt || old.dispatched) && row.distributorId === old.distributorId))
                ) {
                    return {
                        ...row,
                        distributorId: old.distributorId,
                        distributorPolicy: old.distributorPolicy,
                        policyHistory: old.policyHistory,
                    };
                }
                const profile = row.distributorId ? await getDistributor(db, row.distributorId) : undefined;
                if (row.distributorId && !profile) {
                    throw Object.assign(new Error('Select an existing distributor.'), {
                        statusCode: 400,
                    });
                }
                const source = row.replacementFor !== undefined ? previous.shipments?.[row.replacementFor] : undefined;
                const policy =
                    old?.distributorId === row.distributorId && old?.policyHistory?.length
                        ? old.distributorPolicy
                        : source?.distributorId === row.distributorId && source?.distributorPolicy
                          ? source.distributorPolicy
                          : snapshotDistributor(profile);
                const history =
                    old && (old.etaSentAt || old.dispatched) && old.distributorId !== row.distributorId
                        ? [
                              ...(old.policyHistory ?? []),
                              {
                                  policy: old.distributorPolicy,
                                  reason: 'Distributor changed while editing shipment.',
                                  changedAt: new Date().toISOString(),
                                  changedBy: actorId,
                              },
                          ]
                        : old?.policyHistory;
                return {
                    ...row,
                    distributorPolicy: policy,
                    ...(profile
                        ? {
                              supplier: profile.name,
                          }
                        : {}),
                    policyHistory: history,
                };
            }),
        );
    }
    if (sendEtaShipmentIndex !== undefined) {
        const rows = updates.shipments;
        if (rows?.[sendEtaShipmentIndex]?.shipmentSource === 'agency') {
            throw transferError('Authorize and reserve the agency transfer before shipping.');
        }
        if (
            !Array.isArray(rows) ||
            !Number.isSafeInteger(sendEtaShipmentIndex) ||
            sendEtaShipmentIndex < 0 ||
            sendEtaShipmentIndex >= rows.length
        ) {
            throw Object.assign(new Error('Select a valid shipment.'), {
                statusCode: 400,
            });
        }
        rows[sendEtaShipmentIndex] = {
            ...rows[sendEtaShipmentIndex]!,
            shipmentFormula:
                previous.shipments?.[sendEtaShipmentIndex]?.etaSentAt &&
                previous.shipments[sendEtaShipmentIndex]?.shipmentFormula
                    ? previous.shipments[sendEtaShipmentIndex]!.shipmentFormula
                    : requireShipmentFormula(previous, rows[sendEtaShipmentIndex]!),
        };
        let size = rows[sendEtaShipmentIndex]!.unitsPerCase;
        if (!validUnitSize(size)) {
            size = await shipmentCatalogPackaging(db, previous, rows[sendEtaShipmentIndex]!);
        }
        if (quantityTracking && !validUnitSize(size)) {
            throw Object.assign(new Error('Enter Units per Case before sending ETA.'), {
                statusCode: 400,
                statusMessage: 'Enter Units per Case before sending ETA.',
            });
        }
        rows[sendEtaShipmentIndex] = {
            ...rows[sendEtaShipmentIndex]!,
            unitsPerCase: size,
        };
        const message = validateShipments([rows[sendEtaShipmentIndex]!], true);
        if (message) {
            throw Object.assign(new Error(message), {
                statusCode: 400,
                statusMessage: message,
            });
        }
        updates = {
            ...updates,
            shipments: rows.map((row, index) =>
                index === sendEtaShipmentIndex
                    ? {
                          ...row,
                          etaSentAt: new Date().toISOString(),
                      }
                    : {
                          ...row,
                      },
            ),
        };
        const allSent = updates.shipments!.every((row) => row.etaSentAt);
        updates.status = allSent ? 'shipped' : previous.status === 'shipped' ? 'in_progress' : previous.status;
    }
    if (updates.shipments !== undefined) {
        const message = validateShipments(updates.shipments, (updates.status ?? previous.status) === 'shipped');
        if (message) {
            throw Object.assign(new Error(message), {
                statusCode: 400,
                statusMessage: message,
            });
        }
        const shipments = preserveShipmentReceipts(previous, updates.shipments);
        const preservedError = validateShipments(shipments, (updates.status ?? previous.status) === 'shipped');
        if (preservedError) {
            throw Object.assign(new Error(preservedError), {
                statusCode: 400,
                statusMessage: preservedError,
            });
        }
        updates = {
            ...updates,
            ...shipmentUpdates(shipments),
        };
    }
    // Shipment receipt records are authoritative; an older screen must not undo them.
    const merged = {
        ...previous,
        ...updates,
    };
    const rows = requestShipments(merged);
    if (rows.some((row) => row.receivedAt || row.receiptConfirmed)) {
        const previousIssue = ['damaged', 'missing', 'incomplete'].includes(previous.receivedStatus ?? '');
        const explicitResolution = updates.receivedStatus === 'received' && updates.status === 'complete';
        if (previousIssue && !explicitResolution && (!updates.receivedStatus || updates.receivedStatus === 'shipped')) {
            updates.receivedStatus = previous.receivedStatus;
            updates.status = previous.status;
        }
        const hasIssue =
            ['damaged', 'missing', 'incomplete'].includes(updates.receivedStatus ?? previous.receivedStatus ?? '') ||
            ['damaged', 'missing'].includes(updates.status ?? previous.status);
        const allReceived = rows.every((row) => shipmentFinished(merged, row));
        if (allReceived && !hasIssue) {
            updates.status = 'complete';
            updates.receivedStatus = 'received';
        } else if (!allReceived && (updates.receivedStatus ?? previous.receivedStatus) === 'received') {
            updates.receivedStatus = 'shipped';
            updates.status = rows.every((row) => row.etaSentAt) ? 'shipped' : 'in_progress';
        }
    }
    if (rows.some(activeShipmentIssue)) {
        Object.assign(
            updates,
            shipmentIssueSummary(
                {
                    ...previous,
                    ...updates,
                },
                rows,
            ),
        );
    }
    const finalRequest = {
        ...previous,
        ...updates,
    };
    if (updates.status === 'complete' && !splitOrderFulfillmentComplete(finalRequest)) {
        updates.status = rows.every((row) => shipmentDispatched(finalRequest, row)) ? 'shipped' : 'in_progress';
        updates.receivedStatus = 'shipped';
    }
    const baseline =
        originalCaseApproval(previous) ??
        originalCaseApproval({
            ...previous,
            ...updates,
        });
    if (
        baseline !== undefined &&
        (sendEtaShipmentIndex !== undefined || rows.some((row) => shipmentDispatched(previous, row)))
    ) {
        updates.originalApprovedCases = baseline;
    }
    if (pendingDrafts) {
        updates.shipmentDrafts = pendingDrafts.map((row, index) =>
            index === sendEtaShipmentIndex ? updates.shipments![index]! : row,
        );
    }
    const shippingSteps = updates.shipping
        ? [
              db
                  .prepare(
                      "UPDATE surplus_transfers SET destination_shipping=? WHERE request_id=? AND status='reserved'",
                  )
                  .bind(JSON.stringify(updates.shipping), previous.id),
          ]
        : [];
    const next = nextRecord(previous, updates);
    return writeRecord(
        db,
        previous,
        sendEtaShipmentIndex !== undefined ? publishAuthorization(next, sendEtaShipmentIndex) : next,
        requireUnopened,
        shippingSteps,
    );
}
