import {normalizeShipping,validateShipping} from '../../../shared/shipping';
import {resolveShipping} from '../../utils/clinicStore';
import {validateFormulaAuthorizations} from '../../../shared/formulaAuthorizations';
import type {SimpleShipmentReceiptCommand} from '../../../shared/simpleShipmentReceipts';
import {authorizeRequestTransfer} from '../../utils/requestTransfers';
import {shipmentFeatureFlags,shipmentCaseActionEnabled} from '../../../shared/featureFlags';
import type {ShipmentCaseCommand} from '../../../shared/shipmentCaseTracking';
import type {ShipmentPolicyCommand} from '../../../shared/shipmentPolicy';
import type {ShipmentIssueCommand} from '../../../shared/shipmentIssues';
import {requestShipments} from '../../../shared/requestShipments';
import {confirmShipmentReceipts,shipmentReceived,shipmentFinished,type ShipmentReceiptSelection} from '../../../shared/shipmentReceipts';
import type { RequestRecord } from '../../../shared/domain';
import { getRequestById, updateRequestRecord } from '../../utils/requestStore';
import { submittedRequest, ensureSubmittedRequest, deleteSubmittedShipment, updateSubmittedRequest, updateSubmittedShipmentIssue, updateSubmittedShipmentCases, updateSubmittedShipmentReceipt, updateSubmittedShipmentPolicy, updateSubmittedSimpleShipmentReceipt } from '../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../utils/session';
import { canSeeAgency, isReviewer } from '../../../shared/surplus';
import { submissionFields } from '../../../shared/requestEditing';
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const updates = await readBody<Partial<RequestRecord> & {confirmShipmentReceipt?:SimpleShipmentReceiptCommand;shipmentPolicy?:ShipmentPolicyCommand;reserveTransferIndex?:number;deleteShipmentIndex?:number;sendEtaShipmentIndex?:number;confirmShipmentReceipts?:ShipmentReceiptSelection[];shipmentIssue?:ShipmentIssueCommand;shipmentCases?:ShipmentCaseCommand}>(event);
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    if (!env?.CDPHWIC) throw createError({ statusCode: 503, statusMessage: 'Request database unavailable.' });
    const saved = await submittedRequest(env.CDPHWIC, id, user);
    const raw = saved ?? getRequestById(id);
    if (!raw || !canSeeAgency(user, raw.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    const previous = saved ?? (await ensureSubmittedRequest(env.CDPHWIC, raw));
    if(updates.reserveTransferIndex!==undefined){
        if(updates.revision!==(previous.revision??0))throw createError({statusCode:409,statusMessage:'Shipment details changed. Reload before authorizing a transfer.'});
        const request=await authorizeRequestTransfer(env.CDPHWIC,previous,updates.shipmentDrafts??[],updates.reserveTransferIndex,user);
        updateRequestRecord(id,request);return {request};
    }
    if(updates.deleteShipmentIndex!==undefined){
        if(!isReviewer(user))throw createError({statusCode:403,statusMessage:'Only Admin or CDPH/WIC can delete shipments.'});
        if(updates.revision!==(previous.revision??0))throw createError({statusCode:409,statusMessage:'Shipment details changed. Reload the request before deleting a shipment.'});
        const request=await deleteSubmittedShipment(env.CDPHWIC,previous,updates.deleteShipmentIndex,user.id);
        updateRequestRecord(id,request);
        return {request};
    }
    if(updates.shipmentPolicy!==undefined){
        if(!isReviewer(user))throw createError({statusCode:403});
        const request=await updateSubmittedShipmentPolicy(env.CDPHWIC,previous,updates.shipmentPolicy,user.id);updateRequestRecord(id,request);return {request};
    }
    if (updates.shipmentCases!==undefined) {
        if(!shipmentCaseActionEnabled(updates.shipmentCases?.action,shipmentFeatureFlags(useRuntimeConfig(event).public)))throw createError({statusCode:409,statusMessage:'Case reconciliation is currently disabled.'});
        if (['replacement','close-replaced'].includes(updates.shipmentCases?.action) && !isReviewer(user)) throw createError({statusCode:403,statusMessage:'Only CDPH/WIC or Admin can create replacements or close originals as replaced.'});
        const request=await updateSubmittedShipmentCases(env.CDPHWIC,previous,updates.shipmentCases,user.id);
        updateRequestRecord(id,request);
        return {request,demo:true};
    }
    if (updates.shipmentIssue !== undefined) {
        if(updates.shipmentIssue?.action==='resolve-received'&&!shipmentFeatureFlags(useRuntimeConfig(event).public).receiptQuantities)throw createError({statusCode:409,statusMessage:'Quantity tracking is currently disabled.'});
        if (updates.shipmentIssue?.action==='respond') {
            if (!isReviewer(user)) throw createError({statusCode:403,statusMessage:'Only CDPH/WIC or Admin can respond to a shipment issue.'});
        } else if (['update','reopen'].includes(updates.shipmentIssue?.action)) {
            // All users with access to this agency may update or reopen an existing issue.
        } else if (user.memberType !== 'agency' && user.role !== 'admin') throw createError({statusCode:403,statusMessage:'Only Local Agency or Admin can report or resolve a shipment issue.'});
        const request=await updateSubmittedShipmentIssue(env.CDPHWIC,previous,updates.shipmentIssue,user.id);
        updateRequestRecord(id,request);
        return {request,demo:true};
    }
    if(updates.confirmShipmentReceipt!==undefined){
        if(user.memberType!=='agency'&&user.role!=='admin')throw createError({statusCode:403});
        if(shipmentFeatureFlags(useRuntimeConfig(event).public).receiptQuantities)throw createError({statusCode:409,statusMessage:'Use quantity receipt confirmation.'});
        const request=await updateSubmittedSimpleShipmentReceipt(env.CDPHWIC,previous,updates.confirmShipmentReceipt,user.id);updateRequestRecord(id,request);return {request};
    }
    if (updates.confirmShipmentReceipts !== undefined) {
        if(!shipmentFeatureFlags(useRuntimeConfig(event).public).receiptQuantities)throw createError({statusCode:409,statusMessage:'Quantity tracking is currently disabled.'});
        if (user.memberType !== 'agency' && user.role !== 'admin') throw createError({statusCode:403,statusMessage:'Only Local Agency or Admin can confirm receipt.'});
        if (!Array.isArray(updates.confirmShipmentReceipts) || updates.confirmShipmentReceipts.some(row=>row?.receivedCases===undefined || typeof row?.expectedReceipt!=='string')) throw createError({statusCode:400,statusMessage:'Enter actual quantities received before confirming receipt.'});
        const request=await updateSubmittedShipmentReceipt(env.CDPHWIC,previous,updates.confirmShipmentReceipts,user.id);
        updateRequestRecord(id,request);
        return {request,demo:true};
    }
    if(updates.formulaAuthorizations!==undefined){
        if(!isReviewer(user))throw createError({statusCode:403,statusMessage:'Only CDPH/WIC or Admin can edit issuance.'});
        const errors=validateFormulaAuthorizations(updates.formulaAuthorizations);if(errors.length)throw createError({statusCode:400,statusMessage:errors[0]});
    }
    if (!isReviewer(user) && (updates.shipmentDrafts!==undefined || updates.shipments!==undefined || updates.approvedCases!==undefined))
        throw createError({statusCode:403,statusMessage:'Only CDPH/WIC or Admin can edit shipment plans or Approved Cases.'});
    if ((updates.shipments!==undefined || updates.shipmentDrafts!==undefined) && updates.revision!==(previous.revision ?? 0))
        throw createError({statusCode:409,statusMessage:'Shipment details changed. Reload the request before saving shipments.'});
    const changesForm = Object.entries(submissionFields(updates)).some(
        ([key, value]) => JSON.stringify(key === 'surplusItems' ? value ?? [] : value) !== JSON.stringify(key === 'surplusItems' ? previous.surplusItems ?? [] : previous[key as keyof RequestRecord]),
    );
    if (!isReviewer(user) && changesForm)
        throw createError({
            statusCode: 409,
            statusMessage: 'Use Edit submission to update the complete form before Admin/FPU opens it.',
        });
    const { confirmShipmentReceipt:_simpleReceipt, reserveTransferIndex:_reserveTransferIndex, deletedShipments:_deletedShipments, deleteShipmentIndex:_deleteShipmentIndex, prescriptionAttachment, openedAt, revision, shipmentPolicy:_policy, sendEtaShipmentIndex, confirmShipmentReceipts: _receiptSelection, shipmentIssue: _shipmentIssue, shipmentCases: _shipmentCases, originalApprovedCases: _originalApproval, ...safe } = updates;
    if (!isReviewer(user) && (safe.receivedStatus==='received' || safe.status==='complete') && !requestShipments(previous).every(row=>shipmentFinished(previous,row)))
        throw createError({statusCode:409,statusMessage:'Select individual shipments to confirm receipt.'});
    if (safe.shipments) safe.shipments=safe.shipments.map(({receivedAt,receivedBy,receiptConfirmed,dispatched,receivedCases,receivedUnits,damagedUnits,dispositions,receiptCountHistory,replacedAt,replacedBy,replacementClosureNote,issue,deletedIssues,distributorPolicy,policyHistory,replacementBasis,replacementIssueId,...shipment})=>shipment);
    // Older clients also save plans through `shipments`; they must not bypass publication.
    if(safe.shipments){safe.shipmentDrafts=safe.shipments;delete safe.shipments;}
    if (sendEtaShipmentIndex !== undefined && !isReviewer(user)) throw createError({statusCode:403,statusMessage:'Only Admin or CDPH/WIC can send shipment ETAs.'});
    if(safe.shipping!==undefined){
        if(!safe.shipping || typeof safe.shipping!=='object')throw createError({statusCode:400,statusMessage:'Complete the Shipping address.'});
        if(updates.revision!==(previous.revision??0))throw createError({statusCode:409,statusMessage:'Request details changed. Reload before saving Shipping.'});
        if(safe.shipping.clinicId)safe.shipping=await resolveShipping(env.CDPHWIC,user,previous.agencyId,safe.shipping,previous.shipping);
        else {safe.shipping=normalizeShipping(safe.shipping);const message=validateShipping(safe.shipping);if(message)throw createError({statusCode:400,statusMessage:message});}
    }
    const request = await updateSubmittedRequest(env.CDPHWIC, previous, safe, !isReviewer(user) && changesForm, sendEtaShipmentIndex, user.id, undefined, shipmentFeatureFlags(useRuntimeConfig(event).public).quantityTracking);
    updateRequestRecord(id, request);
    return { request, demo: true };
});
