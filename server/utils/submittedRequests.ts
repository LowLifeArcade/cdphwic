import { resolveSurplusClinic } from './surplusClinicLocations';
import {shippingContact} from '../../shared/shipping';
import {requestContact} from './requestAgency';
import {unreadOutgoingMessage} from '../../shared/moreInfoMessages';
import {publishAuthorization} from '../../shared/authorizationPublication';
import {resolveShipmentFormula,requireShipmentFormula,shipmentFormulaKey} from '../../shared/shipmentFormulas';
import {confirmSimpleShipmentReceipt,type SimpleShipmentReceiptCommand} from '../../shared/simpleShipmentReceipts';
import {cancelTransferInventory,transferReceiptSteps,transferError} from './requestTransferInventory';
import {applyShipmentDeletion} from '../../shared/shipmentDeletion';
import {shipmentPlan} from '../../shared/shipmentPublishing';
import {getDistributor} from './distributors';
import {snapshotDistributor} from '../../shared/distributors';
import {applyShipmentPolicy,type ShipmentPolicyCommand} from '../../shared/shipmentPolicy';
import {getProduct,listProducts} from './productStore';
import {transferCatalogUnitsPerCase} from '../../shared/requestTransfers';
import {validUnitSize} from '../../shared/shipmentQuantities';
import {confirmShipmentReceipts,shipmentReceiptKey,type ShipmentReceiptSelection} from '../../shared/shipmentReceipts';
import {applyShipmentCaseCommand,originalCaseApproval,type ShipmentCaseCommand} from '../../shared/shipmentCaseTracking';
import {applyShipmentIssue,activeShipmentIssue,shipmentIssueSummary,type ShipmentIssueCommand} from '../../shared/shipmentIssues';
import {preserveShipmentReceipts,shipmentReceived,shipmentFinished,shipmentDispatched} from '../../shared/shipmentReceipts';
import {validateBreastfeeding} from '../../shared/breastfeeding';
import {validateRequestedMonths} from '../../shared/requestMonthSelection';
import {validateFormulaSelection} from '../../shared/formulaEntries';
import {requestShipments,shipmentUpdates,validateShipments} from '../../shared/requestShipments';
import {resolveShipping} from './clinicStore';
import { canEditSubmission, canReplyToMoreInfo, canReopenMoreInfo, canResolveMoreInfo, hasPendingMoreInfo, latestMoreInfoRequest, submissionFields } from '../../shared/requestEditing';
import { validateRequestSubmission } from '../../shared/requestSubmission';
import {getApprovalStatus} from '../../shared/requestOperations';
import { validDate, localDate } from '../../shared/surplus';
import type { RequestRecord, SessionUser } from '../../shared/domain';
import { canSeeAgency } from '../../shared/surplus';
export async function submittedRequests(db: D1Database, user: SessionUser) {
    const rows = await db
        .prepare('SELECT request_json FROM surplus_submissions WHERE (?=1 OR agency_id=?)')
        .bind(user.role === 'admin' || user.memberType === 'internal' ? 1 : 0, user.agencyId ?? -1)
        .all<{ request_json: string }>();
    return rows.results.map((row) => JSON.parse(row.request_json) as RequestRecord);
}
export async function submittedRequest(db: D1Database, id: number, user: SessionUser) {
    return (await submittedRequests(db, user)).find((r) => r.id === id);
}
export async function ensureSubmittedRequest(db: D1Database, previous: RequestRecord) {
    const id = previous.submissionId ?? `legacy-${previous.id}`;
    const request = { ...previous, submissionId: id };
    await db
        .prepare(
            'INSERT OR IGNORE INTO surplus_submissions(id,agency_id,request_json,payload,actor_id) VALUES(?,?,?,?,?)',
        )
        .bind(id, request.agencyId, JSON.stringify(request), 'legacy', 0)
        .run();
    return JSON.parse(
        (await db
            .prepare('SELECT request_json FROM surplus_submissions WHERE id=?')
            .bind(id)
            .first<string>('request_json'))!,
    ) as RequestRecord;
}
function conflict(
    message = 'This submission was changed or opened by Admin/FPU. Reload it before making further updates.',
) {
    return Object.assign(new Error(message), { statusCode: 409, statusMessage: message });
}
function nextRecord(previous: RequestRecord, updates: Partial<RequestRecord>) {
    const request = {
        ...previous,
        ...updates,
        id: previous.id,
        submissionId: previous.submissionId,
        submissionDate: previous.submissionDate,
        agencyId: previous.agencyId,
        agencyMemberId: previous.agencyMemberId,
        revision: (previous.revision ?? 0) + 1,
    };
    request.openedAt =
        previous.openedAt ??
        (previous.status !== 'unopened' || request.status !== 'unopened' ? new Date().toISOString() : undefined);
    return request;
}
async function writeRecord(
    db: D1Database,
    previous: RequestRecord,
    request: RequestRecord,
    unopened: boolean,
    extra: D1PreparedStatement[] = [],
) {
    if(hasPendingMoreInfo(previous) && hasPendingMoreInfo({...request,status:'needs_info'})) request.status='needs_info';
    const condition = unopened
        ? " AND json_extract(request_json,'$.status')='unopened' AND json_extract(request_json,'$.openedAt') IS NULL"
        : '';
    try {
        await db.batch([
            db
                .prepare(
                    `INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_submissions WHERE id=? AND request_json=?${condition}) THEN 1 ELSE 0 END`,
                )
                .bind(previous.submissionId, JSON.stringify(previous)),
            db
                .prepare('UPDATE surplus_submissions SET request_json=? WHERE id=?')
                .bind(JSON.stringify(request), previous.submissionId),
            ...extra,
            db.prepare('DELETE FROM surplus_guard'),
        ]);
    } catch {
        throw conflict();
    }
    return request;
}
export async function updateSubmittedRequest(
    db: D1Database,
    previous: RequestRecord,
    updates: Partial<RequestRecord>,
    requireUnopened = false,
    sendEtaShipmentIndex?: number,
    actorId = 0,
    pendingDrafts?: RequestRecord['shipments'],
    quantityTracking=true,
) {
    if(updates.surplusItems!==undefined)for(const [index,item] of updates.surplusItems.entries()){
        if(item.clinicId!==previous.surplusItems?.[index]?.clinicId)await resolveSurplusClinic(db,previous.agencyId,item.clinicId);
    }
    const incomingPlans=updates.shipmentDrafts??updates.shipments;
    for(const [index,row] of (Array.isArray(incomingPlans)?incomingPlans:[]).entries()){
        if(!row)continue;
        const old=previous.shipments?.[index];
        if(old?.shipmentFormula && (old.etaSentAt||old.receivedAt||old.receiptConfirmed||old.issue||old.deletedIssues?.length) && shipmentFormulaKey(row.shipmentFormula)!==shipmentFormulaKey(old.shipmentFormula))throw conflict('The formula cannot be changed after this shipment has been sent.');
        if(row.shipmentFormula && !(old?.shipmentFormula && (old.etaSentAt||old.receivedAt||old.receiptConfirmed||old.issue||old.deletedIssues?.length)))requireShipmentFormula(previous,row);
    }

    if(incomingPlans && Array.isArray(incomingPlans))for(const [index,old] of (previous.shipments??[]).entries()){
        if(!old.transferId)continue;
        const row=incomingPlans[index];
        const compared=row && updates.shipmentDrafts && old.transferStatus==='reserved'?{...old,...row,eta:old.eta,carrier:old.carrier,trackingNumbers:old.trackingNumbers}:row&&({...old,...row});
        if(!compared || JSON.stringify(shipmentPlan(compared))!==JSON.stringify(shipmentPlan(old)))throw transferError('Authorized agency transfers are locked to their reserved quantity and source.');
        if(sendEtaShipmentIndex===index)throw transferError('The sending agency must confirm this transfer shipment.');
    }
    if (updates.shipmentDrafts !== undefined) {
        const drafts = updates.shipmentDrafts;
        const message = !Array.isArray(drafts) ? 'Add a Shipment.' : validateShipments(drafts.map(row=>row && ({...row,etaSentAt:undefined})));
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        const published = previous.shipments ?? (previous.eta || previous.trackingNumbers?.length ? requestShipments(previous) : []);
        // Published rows retain stable indexes used by receipt and issue commands.
        if (drafts.length < published.length) throw conflict('Published shipments cannot be removed.');
        const protectedDrafts = preserveShipmentReceipts({...previous,shipments:published},drafts.map((row,index)=>published[index]?.transferId?{...published[index]!,...(published[index]!.transferStatus==='reserved'?{eta:row.eta,trackingNumbers:[...row.trackingNumbers]}:{})}:({...published[index],...shipmentPlan(row),etaSentAt:published[index]?.etaSentAt,replacementFor:published[index]?.replacementFor})));
        const {shipmentDrafts:_drafts,shipments:_rows,eta:_eta,unitsIssued:_units,trackingNumbers:_tracking,...other} = updates;
        if (sendEtaShipmentIndex === undefined) {
            return writeRecord(db,previous,nextRecord(previous,{...other,shipmentDrafts:protectedDrafts}),requireUnopened);
        }
        if (!Number.isSafeInteger(sendEtaShipmentIndex) || sendEtaShipmentIndex<0 || sendEtaShipmentIndex>=drafts.length || sendEtaShipmentIndex>published.length)
            throw conflict('Send the preceding shipment ETA first.');
        const rows = published.map(row=>({...row}));
        rows[sendEtaShipmentIndex] = protectedDrafts[sendEtaShipmentIndex]!;
        // Reuse authoritative policy, history, validation and atomic revision handling.
        const next = await updateSubmittedRequest(db,previous,{...other,shipments:rows,shipmentDrafts:undefined},requireUnopened,sendEtaShipmentIndex,actorId,protectedDrafts,quantityTracking);
        return next;
    }
    if ('breastfeedingStatus' in updates || 'breastfeedingDiscontinuedDate' in updates) {
        const combined = {...previous,...updates};
        const breastfeedingError = validateBreastfeeding(combined);
        if (breastfeedingError) throw Object.assign(new Error(breastfeedingError), {statusCode:400,statusMessage:breastfeedingError});
        if (combined.breastfeedingStatus !== 'Discontinued BF') updates.breastfeedingDiscontinuedDate = '';
    }
    if (updates.benefitMonthsRequested !== undefined) {
        if (!Array.isArray(updates.benefitMonthsRequested)) throw Object.assign(new Error('Select up to 3 distinct Benefit Months Requested.'), {statusCode:400});
        const monthError = validateRequestedMonths(updates.benefitMonthsRequested);
        if (monthError) throw Object.assign(new Error(monthError), {statusCode:400,statusMessage:monthError});
    }
    if (updates.requestedFormulas !== undefined) {
        if (!Array.isArray(updates.requestedFormulas) || !updates.requestedFormulas.length)
            throw Object.assign(new Error('Add at least one formula.'), {statusCode:400});
        const formulaError = validateFormulaSelection(updates.requestedFormulas.map(formula => ({name:formula.otherFormulaName || formula.productName,form:formula.productForm,flavor:formula.flavor})));
        if (formulaError) throw Object.assign(new Error(formulaError), {statusCode:400,statusMessage:formulaError});
    }
    if (updates.shipments) {
        updates.shipments=await Promise.all(updates.shipments.map(async(row,index)=>{
            const old=previous.shipments?.[index];
            const hasHistory=!!old && (shipmentReceived(previous,old)||!!old.receiptConfirmed||!!old.receivedAt||old.receivedCases!==undefined||old.receivedUnits!==undefined||!!old.issue||!!old.deletedIssues?.length||!!old.dispositions?.length);
            if(hasHistory && row.distributorId!==old?.distributorId)throw Object.assign(new Error('The distributor cannot be changed after receipt or issue records exist.'),{statusCode:409,statusMessage:'The distributor cannot be changed after receipt or issue records exist.'});
            if(old && (hasHistory||((old.etaSentAt||old.dispatched)&&row.distributorId===old.distributorId)))return {...row,distributorId:old.distributorId,distributorPolicy:old.distributorPolicy,policyHistory:old.policyHistory};
            const profile=row.distributorId?await getDistributor(db,row.distributorId):undefined;
            if(row.distributorId&&!profile)throw Object.assign(new Error('Select an existing distributor.'),{statusCode:400});
            const source=row.replacementFor!==undefined?previous.shipments?.[row.replacementFor]:undefined;
            const policy=old?.distributorId===row.distributorId && old?.policyHistory?.length?old.distributorPolicy:source?.distributorId===row.distributorId && source?.distributorPolicy?source.distributorPolicy:snapshotDistributor(profile);
            const history=old && (old.etaSentAt||old.dispatched) && old.distributorId!==row.distributorId?[...(old.policyHistory??[]),{policy:old.distributorPolicy,reason:'Distributor changed while editing shipment.',changedAt:new Date().toISOString(),changedBy:actorId}]:old?.policyHistory;
            return {...row,distributorPolicy:policy,...(profile?{supplier:profile.name}:{}),policyHistory:history};
        }));
    }
    if (sendEtaShipmentIndex !== undefined) {
        const rows = updates.shipments;
        if(rows?.[sendEtaShipmentIndex]?.shipmentSource==='agency')throw transferError('Authorize and reserve the agency transfer before shipping.');
        if (!Array.isArray(rows) || !Number.isSafeInteger(sendEtaShipmentIndex) || sendEtaShipmentIndex < 0 || sendEtaShipmentIndex >= rows.length)
            throw Object.assign(new Error('Select a valid shipment.'), {statusCode:400});
        rows[sendEtaShipmentIndex]={...rows[sendEtaShipmentIndex]!,shipmentFormula:previous.shipments?.[sendEtaShipmentIndex]?.etaSentAt && previous.shipments[sendEtaShipmentIndex]?.shipmentFormula ? previous.shipments[sendEtaShipmentIndex]!.shipmentFormula : requireShipmentFormula(previous,rows[sendEtaShipmentIndex]!)};
        let size=rows[sendEtaShipmentIndex]!.unitsPerCase;
        if (!validUnitSize(size)) size=shipmentCatalogPackaging(previous,rows[sendEtaShipmentIndex]!);
        if (quantityTracking && !validUnitSize(size)) throw Object.assign(new Error('Enter Units per Case before sending ETA.'),{statusCode:400,statusMessage:'Enter Units per Case before sending ETA.'});
        rows[sendEtaShipmentIndex]={...rows[sendEtaShipmentIndex]!,unitsPerCase:size};
        const message = validateShipments([rows[sendEtaShipmentIndex]!], true);
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        updates = {...updates, shipments:rows.map((row,index) => index === sendEtaShipmentIndex ? {...row,etaSentAt:new Date().toISOString()} : {...row})};
        const allSent = updates.shipments!.every(row => row.etaSentAt);
        updates.status = allSent ? 'shipped' : previous.status === 'shipped' ? 'in_progress' : previous.status;
    }
    if (updates.shipments !== undefined) {
        const message = validateShipments(updates.shipments, (updates.status ?? previous.status) === 'shipped');
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        const shipments=preserveShipmentReceipts(previous,updates.shipments);
        const preservedError=validateShipments(shipments,(updates.status??previous.status)==='shipped');
        if(preservedError)throw Object.assign(new Error(preservedError),{statusCode:400,statusMessage:preservedError});
        updates = {...updates,...shipmentUpdates(shipments)};
    }
    // Shipment receipt records are authoritative; an older screen must not undo them.
    const merged={...previous,...updates};
    const rows=requestShipments(merged);
    if (rows.some(row=>row.receivedAt || row.receiptConfirmed)) {
        const previousIssue=['damaged','missing','incomplete'].includes(previous.receivedStatus ?? '');
        const explicitResolution=updates.receivedStatus==='received' && updates.status==='complete';
        if (previousIssue && !explicitResolution && (!updates.receivedStatus || updates.receivedStatus==='shipped')) {
            updates.receivedStatus=previous.receivedStatus;
            updates.status=previous.status;
        }
        const hasIssue=['damaged','missing','incomplete'].includes(updates.receivedStatus ?? previous.receivedStatus ?? '') || ['damaged','missing'].includes(updates.status ?? previous.status);
        const allReceived=rows.every(row=>shipmentFinished(merged,row));
        if (allReceived && !hasIssue) {updates.status='complete';updates.receivedStatus='received';}
        else if (!allReceived && (updates.receivedStatus ?? previous.receivedStatus)==='received') {
            updates.receivedStatus='shipped';
            updates.status=rows.every(row=>row.etaSentAt) ? 'shipped' : 'in_progress';
        }
    }
    if (rows.some(activeShipmentIssue)) Object.assign(updates,shipmentIssueSummary({...previous,...updates},rows));
    const baseline=originalCaseApproval(previous) ?? originalCaseApproval({...previous,...updates});
    if (baseline!==undefined && (sendEtaShipmentIndex!==undefined || rows.some(row=>shipmentDispatched(previous,row)))) updates.originalApprovedCases=baseline;
    if (pendingDrafts) updates.shipmentDrafts=pendingDrafts.map((row,index)=>index===sendEtaShipmentIndex?updates.shipments![index]!:row);
    const shippingSteps=updates.shipping?[db.prepare("UPDATE surplus_transfers SET destination_shipping=? WHERE request_id=? AND status='reserved'").bind(JSON.stringify(updates.shipping),previous.id)]:[];
    const next=nextRecord(previous,updates);
    return writeRecord(db, previous, sendEtaShipmentIndex!==undefined?publishAuthorization(next,sendEtaShipmentIndex):next, requireUnopened,shippingSteps);
}
export async function deleteSubmittedShipment(db:D1Database,previous:RequestRecord,index:number,actorId:number){
    const row=previous.shipments?.[index];
    const steps=row?await cancelTransferInventory(db,previous,row,actorId):[];
    return writeRecord(db,previous,nextRecord(previous,applyShipmentDeletion(previous,index,actorId)),false,steps);
}
export async function updateSubmittedShipmentReceipt(db:D1Database,previous:RequestRecord,selections:ShipmentReceiptSelection[],actorId:number) {
    const prepared=prepareCatalogReceiptPackaging(previous,selections);
    const updates={...confirmShipmentReceipts(prepared.request,prepared.selections,actorId),...(originalCaseApproval(previous)!==undefined?{originalApprovedCases:originalCaseApproval(previous)}:{})};
    return writeRecord(db,previous,nextRecord(previous,updates),false,await transferReceiptSteps(db,previous,updates));
}
export async function updateSubmittedShipmentIssue(db:D1Database,previous:RequestRecord,command:ShipmentIssueCommand,actorId:number) {
    const original=previous;
    if(command.action==='resolve-received' && command.catalogUnitsPerCase!==undefined){
        const prepared=prepareCatalogReceiptPackaging(previous,[command]);previous=prepared.request;command={...command,key:prepared.selections[0]!.key};
    }
    const updates={...applyShipmentIssue(previous,command,actorId),...(originalCaseApproval(previous)!==undefined?{originalApprovedCases:originalCaseApproval(previous)}:{})};
    return writeRecord(db,original,nextRecord(original,updates),false,await transferReceiptSteps(db,original,updates));
}
export async function updateSubmittedShipmentCases(db:D1Database,previous:RequestRecord,command:ShipmentCaseCommand,actorId:number) {
    const updates=applyShipmentCaseCommand(previous,command,actorId);
    if(command.action==='replacement' && previous.shipmentDrafts && updates.shipments){
        const originalCount=requestShipments(previous).length;
        updates.shipmentDrafts=[...previous.shipmentDrafts.slice(0,originalCount),...updates.shipments.slice(originalCount),...previous.shipmentDrafts.slice(originalCount)];
    }
    return writeRecord(db,previous,nextRecord(previous,updates),false);
}
export async function editSubmittedRequest(
    db: D1Database,
    user: SessionUser,
    previous: RequestRecord,
    updates: Partial<RequestRecord>,
    expectedRevision: number,
    options: { attachment?: RequestRecord['prescriptionAttachment'] | null; statements?: D1PreparedStatement[]; saveOnly?:boolean } = {},
) {
    if (!canSeeAgency(user, previous.agencyId))
        throw Object.assign(new Error('Request not found.'), { statusCode: 404 });
    if (
        !canEditSubmission(previous) ||
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision !== (previous.revision ?? 0)
    )
        throw conflict();
    const request = nextRecord(previous, submissionFields(updates));
    if(request.shipping)request.shipping={...request.shipping,...shippingContact(request.shipping,requestContact(user,previous.agencyId,previous.agencyMemberId))};
    if (options.attachment !== undefined) request.prescriptionAttachment = options.attachment ?? undefined;
    if(!options.saveOnly || request.shipping?.clinicId)request.shipping = await resolveShipping(db,user,previous.agencyId,request.shipping,previous.shipping);
    const validation = options.saveOnly ? '' : validateRequestSubmission(request);
    if (validation) throw Object.assign(new Error(validation), { statusCode: 400, statusMessage: validation });
    const rows = (r: RequestRecord) =>
        JSON.stringify(
            (r.surplusItems ?? []).map((e) => [
                e.productName,
                e.productForm ?? '',
                e.flavor ?? '',
                e.units,
                e.expirationDate ?? '',
                e.clinicId ?? '',
            ]),
        );
    const steps: D1PreparedStatement[] = [...(options.statements ?? [])];
    const originalSurplus=hasPendingMoreInfo(previous)?latestMoreInfoRequest(previous)?.originalSurplusItems:previous.surplusItems;
    if (!options.saveOnly && rows({...previous,surplusItems:originalSurplus}) !== rows(request)) {
        steps.push(
            db
                .prepare(
                    "INSERT INTO surplus_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM surplus_reports WHERE submission_id=? AND status NOT IN ('pending','superseded')) THEN 1 ELSE 0 END",
                )
                .bind(previous.submissionId),
        );
        steps.push(
            db
                .prepare("UPDATE surplus_reports SET status='superseded' WHERE submission_id=? AND status='pending'")
                .bind(previous.submissionId),
        );
        for (const [index, row] of (request.surplusItems ?? []).entries()) {
            if (row.expirationDate && !validDate(row.expirationDate))
                throw conflict('Enter a valid surplus expiration date.');
            const clinic = await resolveSurplusClinic(db, previous.agencyId, row.clinicId);
            const id = `${previous.submissionId}:edit:${request.revision}:${index}`;
            steps.push(
                db
                    .prepare(
                        'INSERT INTO surplus_reports(id,submission_id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    )
                    .bind(
                        id,
                        previous.submissionId,
                        `edit:${request.revision}:${index}`,
                        previous.agencyId,
                        row.productName.trim().replace(/\s+/g, ' '),
                        row.productForm,
                        (row.flavor ?? '').trim().replace(/\s+/g, ' '),
                        row.expirationDate ?? '',
                        row.units,
                        previous.submissionId,
                        user.id,
                        localDate(),
                        user.name,
                        clinic.clinicId ?? null,
                        clinic.clinicName ?? null,
                        clinic.clinicAddress ? JSON.stringify(clinic.clinicAddress) : null,
                    ),
            );
        }
    }
    if(hasPendingMoreInfo(previous) && !options.saveOnly){request.status='unopened';request.openedAt=undefined;request.moreInfoRequests=previous.moreInfoRequests!.map(entry=>entry.id===latestMoreInfoRequest(previous)?.id?{...entry,resubmissionOpen:false,resubmittedAt:new Date().toISOString(),resubmittedBy:user.id}:entry);}
    return writeRecord(db, previous, request, !hasPendingMoreInfo(previous), steps);
}

export async function updateSubmittedShipmentPolicy(db:D1Database,previous:RequestRecord,command:ShipmentPolicyCommand,actor:number){return writeRecord(db,previous,nextRecord(previous,applyShipmentPolicy(previous,command,actor)),false);}
export async function persistShipmentEvidence(db:D1Database,previous:RequestRecord,index:number,expectedIssue:string,patch:Partial<NonNullable<NonNullable<RequestRecord['shipments']>[number]['issue']>>){
 const rows=requestShipments(previous);const row=rows[index];
 if(!row?.issue||JSON.stringify(row.issue)!==expectedIssue)throw Object.assign(new Error('Issue changed. Refresh before adding evidence.'),{statusCode:409,statusMessage:'Issue changed. Refresh before adding evidence.'});
 rows[index]={...row,issue:{...row.issue,...patch}};
 return writeRecord(db,previous,nextRecord(previous,{shipments:rows}),false);
}

function shipmentCatalogPackaging(request:RequestRecord,row:NonNullable<RequestRecord['shipments']>[number]){
 const formula=row.shipmentFormula??resolveShipmentFormula(request,row);
 const matched=formula?transferCatalogUnitsPerCase({formulaName:formula.productName,form:formula.productForm??'',flavor:formula.flavor},listProducts()):undefined;
 if(validUnitSize(matched))return matched;
 if((request.requestedFormulas?.length??1)<=1&&request.productId){try{return getProduct(request.productId).unitsPerCase;}catch{}}
 return undefined;
}
function prepareCatalogReceiptPackaging(previous:RequestRecord,selections:ShipmentReceiptSelection[]){
 const rows=requestShipments(previous);let changed=false;
 const fail=():never=>{throw Object.assign(new Error('Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.'),{statusCode:409,statusMessage:'Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.'});};
 const normalized=selections.map(selection=>{
  if(selection.catalogUnitsPerCase===undefined)return selection;
  const row=rows[selection.index];if(!row||shipmentReceiptKey(row)!==selection.key||validUnitSize(row.unitsPerCase))fail();
  const size=shipmentCatalogPackaging(previous,row!);
  if(!validUnitSize(size)||size!==selection.catalogUnitsPerCase)fail();
  rows[selection.index]={...row!,unitsPerCase:size};changed=true;return {...selection,key:shipmentReceiptKey(rows[selection.index]!)};
 });
 return {request:changed?{...previous,shipments:rows}:previous,selections:normalized};
}

export function commitRequestTransfer(db:D1Database,previous:RequestRecord,updates:Partial<RequestRecord>,steps:D1PreparedStatement[]){return writeRecord(db,previous,nextRecord(previous,updates),false,steps);}

export async function updateSubmittedSimpleShipmentReceipt(db:D1Database,previous:RequestRecord,command:SimpleShipmentReceiptCommand,actorId:number){
 const updates=confirmSimpleShipmentReceipt(previous,command,actorId);
 return writeRecord(db,previous,nextRecord(previous,updates),false,await transferReceiptSteps(db,previous,updates));
}

export interface ReviewDecisionCommand {action:'approve'|'deny'|'reopen'|'clear'|'request-info';reason?:string;notes?:string}
export async function reviewSubmittedRequest(db:D1Database,previous:RequestRecord,user:SessionUser,command:ReviewDecisionCommand,revision:number){
 if(user.role!=='admin'&&user.memberType!=='internal')throw Object.assign(new Error('Only CDPH/WIC or Admin can make review decisions.'),{statusCode:403,statusMessage:'Only CDPH/WIC or Admin can make review decisions.'});
 if(!command||!['approve','deny','reopen','clear','request-info'].includes(command.action))throw Object.assign(new Error('Select a valid review decision.'),{statusCode:400});
 if(revision!==(previous.revision??0))throw conflict();
 if(command.action==='reopen'){
  if(previous.status!=='denied')throw conflict('Only a denied request can be reopened.');
  return writeRecord(db,previous,nextRecord(previous,{status:'in_progress',approved:false}),false);
 }
 if(command.action==='clear'){
  if(previous.status!=='denied'&&previous.status!=='approved'&&previous.approved!==true)throw conflict('There is no saved review decision to clear.');
  return writeRecord(db,previous,nextRecord(previous,{status:previous.status==='denied'||previous.status==='approved'?'in_progress':previous.status,approved:false,denialReason:undefined}),false);
 }
 if(command.action==='request-info')return requestMoreInfo(db,previous,user,command.notes!,revision);
 if(command.action==='deny'&&(typeof command.reason!=='string'||!command.reason.trim()||command.reason.length>4000))throw Object.assign(new Error('Enter a reason for denial.'),{statusCode:400,statusMessage:'Enter a reason for denial.'});
 const now=new Date().toISOString();
 const moreInfoRequests=previous.moreInfoRequests?.map(note=>note.deletedAt||note.resolvedAt?note:{...note,resubmissionOpen:false,resolvedAt:now,resolvedBy:user.id});
 return writeRecord(db,previous,nextRecord(previous,{approved:command.action==='approve',status:command.action==='deny'?'denied':getApprovalStatus(previous.status),...(command.action==='deny'?{denialReason:command.reason!.trim()}:{}),moreInfoRequests}),false);
}

export async function requestMoreInfo(db:D1Database,previous:RequestRecord,user:SessionUser,notes:string,revision:number){
 if(user.role!=='admin'&&user.memberType!=='internal')throw Object.assign(new Error('Only CDPH/WIC or Admin can request more information.'),{statusCode:403});
 if(typeof notes!=='string'||!notes.trim()||notes.length>4000)throw Object.assign(new Error('Enter notes describing what needs to be addressed.'),{statusCode:400,statusMessage:'Enter notes describing what needs to be addressed.'});
 if(revision!==(previous.revision??0))throw conflict();
 const moreInfoRequests=[...(previous.moreInfoRequests??[]),{id:crypto.randomUUID(),notes:notes.trim(),requestedAt:new Date().toISOString(),requestedBy:user.id,statusBeforeRequest:previous.status==='unopened'?'opened' as const:previous.status,originalSurplusItems:structuredClone(previous.surplusItems??[])}];
 return writeRecord(db,previous,nextRecord(previous,{status:'needs_info',moreInfoRequests}),false);
}

export interface MoreInfoNoteCommand {noteId:string;action:'edit'|'delete';notes?:string}
export async function editMoreInfoNote(db:D1Database,previous:RequestRecord,user:SessionUser,command:MoreInfoNoteCommand,revision:number){
 if(user.role!=='admin'&&user.memberType!=='internal')throw Object.assign(new Error('Only CDPH/WIC or Admin can edit or delete these notes.'),{statusCode:403,statusMessage:'Only CDPH/WIC or Admin can edit or delete these notes.'});
 if(revision!==(previous.revision??0))throw conflict();
 if(!command||!['edit','delete'].includes(command.action))throw Object.assign(new Error('Select a valid note action.'),{statusCode:400});
 const note=previous.moreInfoRequests?.find(entry=>entry.id===command.noteId&&!entry.deletedAt);
 if(!note)throw Object.assign(new Error('Note not found.'),{statusCode:404,statusMessage:'Note not found.'});
 const noticeIds=[`followup:${note.id}`,...(note.responses??[]).map(response=>`followup-response:${response.id}`)];
 const reads=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(noticeIds)).first();
 if(note.deletionLocked||note.readAt||note.responses?.some(response=>response.readAt)||reads)throw Object.assign(new Error('A message that has been read cannot be edited or deleted.'),{statusCode:409,statusMessage:'A message that has been read cannot be edited or deleted.'});
 if(command.action==='edit'&&(typeof command.notes!=='string'||!command.notes.trim()||command.notes.length>4000))throw Object.assign(new Error('Enter a note of up to 4000 characters.'),{statusCode:400,statusMessage:'Enter a note of up to 4000 characters.'});
 const now=new Date().toISOString();
 const moreInfoRequests=previous.moreInfoRequests!.map(entry=>entry.id!==note.id?entry:command.action==='delete'?{...entry,resubmissionOpen:false,deletedAt:now,deletedBy:user.id}:{...entry,notes:command.notes!.trim(),editedAt:now,editedBy:user.id,noteHistory:[...(entry.noteHistory??[]),{notes:entry.notes,changedAt:now,changedBy:user.id}]});
 const steps=command.action==='edit'?[db.prepare('DELETE FROM surplus_notice_reads WHERE notice_id=?').bind(`followup:${note.id}`)]:[];
 const withdrawing=command.action==='delete' && note.id===latestMoreInfoRequest(previous)?.id && previous.status==='needs_info';
 const stillPending=hasPendingMoreInfo({status:'needs_info',moreInfoRequests});
 const status=withdrawing&&!stillPending?(note.statusBeforeRequest&&note.statusBeforeRequest!=='needs_info'?note.statusBeforeRequest:'in_progress'):previous.status;
 return writeRecord(db,previous,nextRecord(previous,{moreInfoRequests,status}),false,steps);
}

export interface MoreInfoReply {noteId:string;notes:string}
export async function replyToMoreInfo(db:D1Database,previous:RequestRecord,user:SessionUser,reply:MoreInfoReply,revision:number){
 const reviewer=user.role==='admin'||user.memberType==='internal';
 if(!reviewer&&user.memberType!=='agency')throw Object.assign(new Error('Only CDPH/WIC, Admin or the Local Agency can respond.'),{statusCode:403,statusMessage:'Only CDPH/WIC, Admin or the Local Agency can respond.'});
 if(!canSeeAgency(user,previous.agencyId))throw Object.assign(new Error('Request not found.'),{statusCode:404});
 if(revision!==(previous.revision??0))throw conflict();
 if(!reply||typeof reply.notes!=='string'||!reply.notes.trim()||reply.notes.length>4000)throw Object.assign(new Error('Enter an answer of up to 4000 characters.'),{statusCode:400,statusMessage:'Enter an answer of up to 4000 characters.'});
 const note=previous.moreInfoRequests?.find(entry=>entry.id===reply.noteId&&!entry.deletedAt&&!entry.resolvedAt);
 if(!canReplyToMoreInfo(previous,reply.noteId)||!note)throw Object.assign(new Error('This information request is no longer awaiting a response.'),{statusCode:409,statusMessage:'This information request is no longer awaiting a response.'});
 const outgoing=unreadOutgoingMessage(note,reviewer);
 if(outgoing){const id=outgoing.type==='initial'?`followup:${note.id}`:`followup-response:${outgoing.id}`;const read=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id=? LIMIT 1').bind(id).first();if(!read)throw Object.assign(new Error('Edit your unread message instead of sending another.'),{statusCode:409,statusMessage:'Edit your unread message instead of sending another.'});}
 const response={id:crypto.randomUUID(),notes:reply.notes.trim(),respondedAt:new Date().toISOString(),respondedBy:user.id,respondedAs:reviewer?'reviewer' as const:'agency' as const};
 const readHistory=moreInfoReadHistory(previous,user);
 const moreInfoRequests=readHistory!.map(entry=>entry.id===note.id?{...entry,responses:[...(entry.responses??[]),response]}:entry);
 return writeRecord(db,previous,nextRecord(previous,{moreInfoRequests}),false,moreInfoReadNoticeSteps(db,previous,user));
}

export async function resolveMoreInfo(db:D1Database,previous:RequestRecord,user:SessionUser,revision:number){
 if(user.role!=='admin'&&user.memberType!=='internal')throw Object.assign(new Error('Only CDPH/WIC or Admin can resolve information requests.'),{statusCode:403,statusMessage:'Only CDPH/WIC or Admin can resolve information requests.'});
 if(revision!==(previous.revision??0))throw conflict();
 if(!canResolveMoreInfo(previous))throw Object.assign(new Error('There are no outstanding information requests.'),{statusCode:409,statusMessage:'There are no outstanding information requests.'});
 const now=new Date().toISOString();
 const moreInfoRequests=previous.moreInfoRequests!.map(entry=>entry.resolvedAt?entry:{...entry,resubmissionOpen:false,resolvedAt:now,resolvedBy:user.id});
 return writeRecord(db,previous,nextRecord(previous,{status:'in_progress',moreInfoRequests}),false);
}

function moreInfoReadHistory(previous:RequestRecord,user:SessionUser,noticeId?:string){
 const reviewer=user.role==='admin'||user.memberType==='internal';const now=new Date().toISOString();
 return previous.moreInfoRequests?.map(note=>{
  if(note.deletedAt)return note;
  const initialRead=!reviewer&&!note.readAt&&(!noticeId||noticeId===`followup:${note.id}`||noticeId===`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`);
  const reopenedRead=!reviewer&&note.resubmissionOpen&&!note.resubmissionReadAt&&(!noticeId||noticeId===`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`);
  const responses=note.responses?.map(response=>{
   const incoming=reviewer?response.respondedAs!=='reviewer':response.respondedAs==='reviewer';
   return incoming&&!response.readAt&&(!noticeId||noticeId===`followup-response:${response.id}`)?{...response,readAt:now,readBy:user.id}:response;
  });
  return {...note,...(initialRead?{readAt:now,readBy:user.id}:{}),...(reopenedRead?{resubmissionReadAt:now,resubmissionReadBy:user.id}:{}),...(responses?{responses}:{})};
 });
}
export async function markMoreInfoRead(db:D1Database,previous:RequestRecord,user:SessionUser,noticeId?:string){
 if(!canSeeAgency(user,previous.agencyId))throw Object.assign(new Error('Request not found.'),{statusCode:404});
 if(user.role!=='admin'&&user.memberType!=='internal'&&user.memberType!=='agency')throw Object.assign(new Error('Not authorized.'),{statusCode:403});
 let moreInfoRequests=moreInfoReadHistory(previous,user,noticeId);
 // Preserve notification reads recorded before message-level read receipts existed.
 const noticeIds=(previous.moreInfoRequests??[]).flatMap(note=>[`followup:${note.id}`,...(note.responses??[]).map(response=>`followup-response:${response.id}`)]);
 const reads=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(noticeIds)).all<{notice_id:string}>();
 const seen=new Set(reads.results.map(row=>row.notice_id));
 moreInfoRequests=moreInfoRequests?.map(note=>seen.has(`followup:${note.id}`)||note.responses?.some(response=>seen.has(`followup-response:${response.id}`))?{...note,deletionLocked:true}:note);
 const steps=moreInfoReadNoticeSteps(db,previous,user,noticeId);
 if(JSON.stringify(moreInfoRequests)===JSON.stringify(previous.moreInfoRequests)){if(steps.length)await db.batch(steps);return previous;}
 return writeRecord(db,previous,nextRecord(previous,{moreInfoRequests}),false,steps);
}

function moreInfoReadNoticeSteps(db:D1Database,previous:RequestRecord,user:SessionUser,noticeId?:string){
 const reviewer=user.role==='admin'||user.memberType==='internal';
 const ids=(previous.moreInfoRequests??[]).filter(note=>!note.deletedAt).flatMap(note=>[
  ...(!reviewer?[`followup:${note.id}`,...(note.resubmissionOpen&&note.resubmissionOpenedAt?[`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`]:[])]:[]),
  ...(note.responses??[]).filter(response=>reviewer?response.respondedAs!=='reviewer':response.respondedAs==='reviewer').map(response=>`followup-response:${response.id}`),
 ]).filter(id=>!noticeId||id===noticeId);
 return ids.length?[db.prepare('INSERT OR IGNORE INTO surplus_notice_reads(notice_id,user_id) SELECT value,? FROM json_each(?)').bind(user.id,JSON.stringify(ids))]:[];
}

export async function reopenMoreInfoSubmission(db:D1Database,previous:RequestRecord,user:SessionUser,revision:number){
 if(user.role!=='admin'&&user.memberType!=='internal')throw Object.assign(new Error('Only CDPH/WIC or Admin can reopen a request for resubmission.'),{statusCode:403,statusMessage:'Only CDPH/WIC or Admin can reopen a request for resubmission.'});
 if(revision!==(previous.revision??0))throw conflict();
 if(!canReopenMoreInfo(previous))throw Object.assign(new Error('This information request cannot be reopened for resubmission.'),{statusCode:409,statusMessage:'This information request cannot be reopened for resubmission.'});
 const moreInfoRequests=previous.moreInfoRequests!.map(entry=>entry.id===latestMoreInfoRequest(previous)?.id?{...entry,resubmissionOpen:true,resubmissionReadAt:undefined,resubmissionReadBy:undefined,resubmissionOpenedAt:new Date().toISOString(),resubmissionOpenedBy:user.id,originalSurplusItems:structuredClone(previous.surplusItems??[])}:entry);
 return writeRecord(db,previous,nextRecord(previous,{status:'needs_info',moreInfoRequests}),false);
}

export interface MoreInfoMessageEdit {noteId:string;responseId:string;notes:string}
export async function editMoreInfoMessage(db:D1Database,previous:RequestRecord,user:SessionUser,command:MoreInfoMessageEdit,revision:number){
 if(!canSeeAgency(user,previous.agencyId))throw Object.assign(new Error('Request not found.'),{statusCode:404});
 const reviewer=user.role==='admin'||user.memberType==='internal';
 if(!reviewer&&user.memberType!=='agency')throw Object.assign(new Error('Not authorized.'),{statusCode:403});
 if(revision!==(previous.revision??0))throw conflict();
 const note=previous.moreInfoRequests?.find(entry=>entry.id===command?.noteId&&!entry.deletedAt);
 const response=note?.responses?.find(entry=>entry.id===command?.responseId);
 if(!note||!response)throw Object.assign(new Error('Message not found.'),{statusCode:404});
 if((response.respondedAs==='reviewer')!==reviewer)throw Object.assign(new Error('Only the sender can edit this message.'),{statusCode:403,statusMessage:'Only the sender can edit this message.'});
 const read=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id=? LIMIT 1').bind(`followup-response:${response.id}`).first();
 if(response.readAt||read||!canReplyToMoreInfo(previous,note.id))throw Object.assign(new Error('A read or resolved message cannot be edited.'),{statusCode:409,statusMessage:'A read or resolved message cannot be edited.'});
 if(typeof command.notes!=='string'||!command.notes.trim()||command.notes.length>4000)throw Object.assign(new Error('Enter a message of up to 4000 characters.'),{statusCode:400,statusMessage:'Enter a message of up to 4000 characters.'});
 const now=new Date().toISOString();
 const moreInfoRequests=previous.moreInfoRequests!.map(entry=>entry.id===note.id?{...entry,responses:entry.responses!.map(item=>item.id===response.id?{...item,notes:command.notes.trim(),editedAt:now,editedBy:user.id,noteHistory:[...(item.noteHistory??[]),{notes:item.notes,changedAt:now,changedBy:user.id}]}:item)}:entry);
 return writeRecord(db,previous,nextRecord(previous,{moreInfoRequests}),false);
}
export async function readVisibleMoreInfoMessages(db:D1Database,previous:RequestRecord,user:SessionUser,noticeIds:string[],revision:number){
 if(!canSeeAgency(user,previous.agencyId))throw Object.assign(new Error('Request not found.'),{statusCode:404});
 if(revision!==(previous.revision??0))throw conflict();
 if(!Array.isArray(noticeIds)||!noticeIds.length||noticeIds.length>20||noticeIds.some(id=>typeof id!=='string'))throw Object.assign(new Error('Select valid messages.'),{statusCode:400});
 const reviewer=user.role==='admin'||user.memberType==='internal';
 const allowed=new Set((previous.moreInfoRequests??[]).filter(note=>!note.deletedAt).flatMap(note=>[...(!reviewer?[`followup:${note.id}`,...(note.resubmissionOpen?[`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`]:[])]:[]),...(note.responses??[]).filter(response=>(response.respondedAs==='reviewer')!==reviewer).map(response=>`followup-response:${response.id}`)]));
 if(noticeIds.some(id=>!allowed.has(id)))throw Object.assign(new Error('Message not found.'),{statusCode:404});
 let request=previous;for(const id of new Set(noticeIds))request=await markMoreInfoRead(db,request,user,id);
 return request;
}
