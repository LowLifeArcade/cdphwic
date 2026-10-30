import {confirmSimpleShipmentReceipt,type SimpleShipmentReceiptCommand} from '../../shared/simpleShipmentReceipts';
import {cancelTransferInventory,transferReceiptSteps,transferError} from './requestTransferInventory';
import {applyShipmentDeletion} from '../../shared/shipmentDeletion';
import {shipmentPlan} from '../../shared/shipmentPublishing';
import {getDistributor} from './distributors';
import {snapshotDistributor} from '../../shared/distributors';
import {applyShipmentPolicy,type ShipmentPolicyCommand} from '../../shared/shipmentPolicy';
import {getProduct} from './productStore';
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
import { canEditSubmission, submissionFields } from '../../shared/requestEditing';
import { validateRequestSubmission } from '../../shared/requestSubmission';
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
    const incomingPlans=updates.shipmentDrafts??updates.shipments;
    if(incomingPlans && Array.isArray(incomingPlans))for(const [index,old] of (previous.shipments??[]).entries()){
        if(!old.transferId)continue;
        const row=incomingPlans[index];
        if(!row || JSON.stringify(shipmentPlan({...old,...row}))!==JSON.stringify(shipmentPlan(old)))throw transferError('Authorized agency transfers are locked to their reserved quantity and source.');
        if(sendEtaShipmentIndex===index)throw transferError('The sending agency must confirm this transfer shipment.');
    }
    if (updates.shipmentDrafts !== undefined) {
        const drafts = updates.shipmentDrafts;
        const message = !Array.isArray(drafts) ? 'Add a Shipment.' : validateShipments(drafts.map(row=>row && ({...row,etaSentAt:undefined})));
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        const published = previous.shipments ?? (previous.eta || previous.trackingNumbers?.length ? requestShipments(previous) : []);
        // Published rows retain stable indexes used by receipt and issue commands.
        if (drafts.length < published.length) throw conflict('Published shipments cannot be removed.');
        const protectedDrafts = preserveShipmentReceipts({...previous,shipments:published},drafts.map((row,index)=>published[index]?.transferId?{...published[index]!}:({...published[index],...shipmentPlan(row),etaSentAt:published[index]?.etaSentAt,replacementFor:published[index]?.replacementFor})));
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
        let size=rows[sendEtaShipmentIndex]!.unitsPerCase;
        if (!validUnitSize(size) && previous.productId && (previous.requestedFormulas?.length ?? 1)<=1) {try {size=getProduct(previous.productId).unitsPerCase;} catch {}}
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
    return writeRecord(db, previous, nextRecord(previous, updates), requireUnopened,shippingSteps);
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
    options: { attachment?: RequestRecord['prescriptionAttachment'] | null; statements?: D1PreparedStatement[] } = {},
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
    if (options.attachment !== undefined) request.prescriptionAttachment = options.attachment ?? undefined;
    request.shipping = await resolveShipping(db,user,previous.agencyId,request.shipping,previous.shipping);
    const validation = validateRequestSubmission(request);
    if (validation) throw Object.assign(new Error(validation), { statusCode: 400, statusMessage: validation });
    const rows = (r: RequestRecord) =>
        JSON.stringify(
            (r.surplusItems ?? []).map((e) => [
                e.productName,
                e.productForm ?? '',
                e.flavor ?? '',
                e.units,
                e.expirationDate ?? '',
            ]),
        );
    const steps: D1PreparedStatement[] = [...(options.statements ?? [])];
    if (rows(previous) !== rows(request)) {
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
            const id = `${previous.submissionId}:edit:${request.revision}:${index}`;
            steps.push(
                db
                    .prepare(
                        'INSERT INTO surplus_reports(id,submission_id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
                    ),
            );
        }
    }
    return writeRecord(db, previous, request, true, steps);
}

export async function updateSubmittedShipmentPolicy(db:D1Database,previous:RequestRecord,command:ShipmentPolicyCommand,actor:number){return writeRecord(db,previous,nextRecord(previous,applyShipmentPolicy(previous,command,actor)),false);}
export async function persistShipmentEvidence(db:D1Database,previous:RequestRecord,index:number,expectedIssue:string,patch:Partial<NonNullable<NonNullable<RequestRecord['shipments']>[number]['issue']>>){
 const rows=requestShipments(previous);const row=rows[index];
 if(!row?.issue||JSON.stringify(row.issue)!==expectedIssue)throw Object.assign(new Error('Issue changed. Refresh before adding evidence.'),{statusCode:409,statusMessage:'Issue changed. Refresh before adding evidence.'});
 rows[index]={...row,issue:{...row.issue,...patch}};
 return writeRecord(db,previous,nextRecord(previous,{shipments:rows}),false);
}

function prepareCatalogReceiptPackaging(previous:RequestRecord,selections:ShipmentReceiptSelection[]){
 const rows=requestShipments(previous);let changed=false;
 const fail=():never=>{throw Object.assign(new Error('Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.'),{statusCode:409,statusMessage:'Shipment packaging changed or cannot be matched to one catalog product. Refresh the request; CDPH/WIC must confirm Units per Case if it is still missing.'});};
 const normalized=selections.map(selection=>{
  if(selection.catalogUnitsPerCase===undefined)return selection;
  const row=rows[selection.index];if(!row||shipmentReceiptKey(row)!==selection.key||validUnitSize(row.unitsPerCase)||(previous.requestedFormulas?.length??1)>1||!previous.productId)fail();
  let size:number|undefined;try{size=getProduct(previous.productId!).unitsPerCase;}catch{fail();}
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
