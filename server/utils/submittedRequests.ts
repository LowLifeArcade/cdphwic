import {validateBreastfeeding} from '../../shared/breastfeeding';
import {validateRequestedMonths} from '../../shared/requestMonthSelection';
import {validateFormulaSelection} from '../../shared/formulaEntries';
import {shipmentUpdates,validateShipments} from '../../shared/requestShipments';
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
) {
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
    if (sendEtaShipmentIndex !== undefined) {
        const rows = updates.shipments;
        if (!Array.isArray(rows) || !Number.isSafeInteger(sendEtaShipmentIndex) || sendEtaShipmentIndex < 0 || sendEtaShipmentIndex >= rows.length)
            throw Object.assign(new Error('Select a valid shipment.'), {statusCode:400});
        const message = validateShipments([rows[sendEtaShipmentIndex]!], true);
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        updates = {...updates, shipments:rows.map((row,index) => index === sendEtaShipmentIndex ? {...row,etaSentAt:new Date().toISOString()} : {...row})};
        const allSent = updates.shipments!.every(row => row.etaSentAt);
        updates.status = allSent ? 'shipped' : previous.status === 'shipped' ? 'in_progress' : previous.status;
    }
    if (updates.shipments !== undefined) {
        const message = validateShipments(updates.shipments, (updates.status ?? previous.status) === 'shipped');
        if (message) throw Object.assign(new Error(message), {statusCode:400,statusMessage:message});
        updates = {...updates,...shipmentUpdates(updates.shipments)};
    }
    return writeRecord(db, previous, nextRecord(previous, updates), requireUnopened);
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
