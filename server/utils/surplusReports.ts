import { resolveSurplusClinic } from './surplusClinicLocations';
import {ensureSurplusLot,executeSurplusCommand,expireSurplusLots} from './surplusStore';
import { SEED_AGENCIES } from '../data/seed';
import type { RequestRecord, SessionUser } from '../../shared/domain';
import { canSeeAgency, isReviewer, validDate, localDate, lotKey } from '../../shared/surplus';
function reject(message: string) {
    throw Object.assign(new Error(message), { statusCode: 400 });
}
export interface AgencySurplusCountInput {
    operationId:string;
    formulaName:string;
    form:string;
    flavor?:string;
    packaging?:string;
    clinicId?:string;
    quantity:number;
    expirationDate:string;
    date:string;
    confirmerName:string;
    reason?:string;
}
export async function submitAgencySurplusCount(db:D1Database,user:SessionUser,input:AgencySurplusCountInput,today=localDate()) {
    if(user.memberType!=='agency'||!Number.isSafeInteger(user.agencyId)||!SEED_AGENCIES.some(a=>a.id===user.agencyId))
        throw Object.assign(new Error('Only a Local Agency can attest to its own surplus count.'),{statusCode:403});
    if(!input||typeof input!=='object')reject('Enter the physical count details.');
    if(!/^[\w-]{8,100}$/.test(input.operationId)||!input.formulaName?.trim()||!['powder','concentrate','ready-to-feed'].includes(input.form))
        reject('Enter a formula, form, and valid count reference.');
    if(!Number.isSafeInteger(input.quantity)||input.quantity<=0||!validDate(input.expirationDate)||!validDate(input.date)||input.date>today||!input.confirmerName?.trim())
        reject('Enter a positive whole-unit count, valid expiration and count dates, and the staff name attesting to the count.');
    if(input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>2000))reject('Count reason must be 2,000 characters or fewer.');
    const clinic=await resolveSurplusClinic(db,user.agencyId!,input.clinicId);
    await expireSurplusLots(db,today);
    const variant={formulaName:input.formulaName.trim().replace(/\s+/g,' '),form:input.form,flavor:(input.flavor??'').trim().replace(/\s+/g,' '),packaging:(input.packaging??'').trim().replace(/\s+/g,' '),expirationDate:input.expirationDate,clinicId:clinic.clinicId};
    const existing=await db.prepare('SELECT id FROM surplus_lots WHERE agency_id=? AND variant_key=?').bind(user.agencyId,lotKey(variant)).first<{id:string}>();
    const reason=input.reason?.trim()||'Agency-attested physical surplus count';
    const prior=await db.prepare('SELECT actor_id,payload,result FROM surplus_commands WHERE id=?').bind(input.operationId).first<{actor_id:number;payload:string;result:string}>();
    if(prior){
        const command=JSON.parse(prior.payload) as {kind:string;lotId:string;quantity:number;reason?:string;date?:string;confirmerName?:string;clinicId?:string;reportId?:string};
        if(prior.actor_id!==user.id||!existing||command.kind!=='reconcile'||command.reportId||command.lotId!==existing.id||command.quantity!==input.quantity||command.reason!==reason||command.date!==input.date||command.confirmerName!==input.confirmerName.trim()||(command.clinicId??'')!==(clinic.clinicId??''))
            throw Object.assign(new Error('Operation ID already used.'),{statusCode:409});
        return JSON.parse(prior.result);
    }
    const lot=await ensureSurplusLot(db,user.agencyId!,variant);
    return executeSurplusCommand(db,user,{kind:'reconcile',operationId:input.operationId,lotId:lot.id,quantity:input.quantity,expectedVersion:lot.version,reason,date:input.date,confirmerName:input.confirmerName.trim(),clinicId:clinic.clinicId},today);
}
export async function persistSurplusSubmission(
    db: D1Database,
    id: string,
    request: RequestRecord,
    user: SessionUser,
    payload = JSON.stringify(request),
) {
    if (!/^[\w-]{8,100}$/.test(id)) reject('Invalid submission reference.');
    const existing = await db.prepare('SELECT * FROM surplus_submissions WHERE id=?').bind(id).first<any>();
    if (existing) {
        if (existing.payload !== payload || existing.actor_id !== user.id)
            reject('Submission reference already used with different contents.');
        return JSON.parse(existing.request_json) as RequestRecord;
    }
    const steps = [
        db
            .prepare(
                'INSERT OR IGNORE INTO surplus_submissions(id,agency_id,request_json,payload,actor_id) VALUES(?,?,?,?,?)',
            )
            .bind(id, request.agencyId, JSON.stringify(request), payload, user.id),
        db
            .prepare(
                'INSERT INTO surplus_guard(ok) SELECT CASE WHEN payload=? AND actor_id=? AND agency_id=? THEN 1 ELSE 0 END FROM surplus_submissions WHERE id=?',
            )
            .bind(payload, user.id, request.agencyId, id),
    ];
    for (const [index, row] of (request.surplusItems ?? []).entries()) {
        if (
            !row.productForm ||
            (row.expirationDate && !validDate(row.expirationDate)) ||
            !Number.isSafeInteger(row.units) ||
            row.units! <= 0
        )
            reject('Surplus requires a valid form, expiration date when provided, and positive whole units.');
        const clinic = await resolveSurplusClinic(db, request.agencyId, row.clinicId);
        steps.push(
            db
                .prepare(
                    `INSERT OR IGNORE INTO surplus_reports(id,submission_id,row_id,agency_id,formula_name,form,flavor,packaging,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                )
                .bind(
                    `${id}:${index}`,
                    id,
                    String(index),
                    request.agencyId,
                    row.productName.trim().replace(/\s+/g, ' '),
                    row.productForm,
                    (row.flavor ?? '').trim().replace(/\s+/g, ' '),
                    (row.packaging ?? '').trim().replace(/\s+/g, ' '),
                    row.expirationDate ?? '',
                    row.units,
                    id,
                    user.id,
                    localDate(),
                    user.name,
                    clinic.clinicId ?? null,
                    clinic.clinicName ?? null,
                    clinic.clinicAddress ? JSON.stringify(clinic.clinicAddress) : null,
                ),
        );
    }
    steps.push(db.prepare('DELETE FROM surplus_guard'));
    await db.batch(steps);
    return JSON.parse(
        (await db
            .prepare('SELECT request_json FROM surplus_submissions WHERE id=?')
            .bind(id)
            .first<string>('request_json'))!,
    );
}
export async function createForecast(db: D1Database, user: SessionUser, b: any) {
    if (!isReviewer(user)) throw Object.assign(new Error('Admin or FPU access required.'), { statusCode: 403 });
    if (
        !SEED_AGENCIES.some((a) => a.id === b.agencyId) ||
        !['powder', 'concentrate', 'ready-to-feed'].includes(b.form) ||
        !Number.isSafeInteger(b.agencyId) ||
        !b.formulaName?.trim() ||
        !b.form?.trim() ||
        !b.requestRef?.trim() ||
        !validDate(b.dueDate) ||
        !Number.isSafeInteger(b.expectedUnits) ||
        b.expectedUnits < 0
    )
        reject('Complete the agency, formula, form, request, expected whole units and confirmation date.');
    const clinic = await resolveSurplusClinic(db, b.agencyId, b.clinicId);
    const id = crypto.randomUUID();
    await db
        .prepare(
            'INSERT INTO surplus_forecasts(id,agency_id,request_ref,formula_name,form,flavor,packaging,expected_units,due_date,actor_id,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
            id,
            b.agencyId,
            b.requestRef.trim(),
            b.formulaName.trim().replace(/\s+/g, ' '),
            b.form,
            (b.flavor ?? '').trim().replace(/\s+/g, ' '),
            (b.packaging ?? '').trim().replace(/\s+/g, ' '),
            b.expectedUnits,
            b.dueDate,
            user.id,
            clinic.clinicId ?? null,
            clinic.clinicName ?? null,
            clinic.clinicAddress ? JSON.stringify(clinic.clinicAddress) : null,
        )
        .run();
    return { id };
}
export async function confirmForecast(db: D1Database, user: SessionUser, b: any) {
    const f = await db.prepare('SELECT * FROM surplus_forecasts WHERE id=?').bind(b.forecastId).first<any>();
    if (!f || !canSeeAgency(user, f.agency_id))
        throw Object.assign(new Error('Forecast not found.'), { statusCode: 404 });
    if (f.status !== 'awaiting-count') reject('This forecast has already been confirmed.');
    if (
        !Number.isSafeInteger(b.quantity) ||
        b.quantity < 0 ||
        !validDate(b.date) ||
        b.date > localDate() ||
        !validDate(b.expirationDate) ||
        !b.confirmerName?.trim() ||
        (b.quantity !== f.expected_units && !b.reason?.trim())
    )
        reject('Provide actual whole units, count date, expiration, staff name and an explanation for any difference.');
    const clinic = await resolveSurplusClinic(db, f.agency_id, b.clinicId === undefined ? f.clinic_id : b.clinicId);
    const id = crypto.randomUUID();
    await db.batch([
        db
            .prepare(
                "INSERT INTO surplus_guard(ok) SELECT CASE WHEN status='awaiting-count' THEN 1 ELSE 0 END FROM surplus_forecasts WHERE id=?",
            )
            .bind(f.id),
        db
            .prepare(
                'INSERT INTO surplus_reports(id,row_id,agency_id,formula_name,form,flavor,packaging,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name,reason,forecast_id,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            )
            .bind(
                id,
                id,
                f.agency_id,
                f.formula_name,
                f.form,
                f.flavor,
                f.packaging??'',
                b.expirationDate,
                b.quantity,
                f.request_ref,
                user.id,
                b.date,
                b.confirmerName,
                b.reason ?? '',
                f.id,
                clinic.clinicId ?? null,
                clinic.clinicName ?? null,
                clinic.clinicAddress ? JSON.stringify(clinic.clinicAddress) : null,
            ),
        db
            .prepare("UPDATE surplus_forecasts SET status='pending-review',actual_units=?,report_id=? WHERE id=?")
            .bind(b.quantity, id, f.id),
        db.prepare('DELETE FROM surplus_guard'),
    ]);
    return { id };
}
