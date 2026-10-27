import { SEED_AGENCIES } from '../data/seed';
import type { RequestRecord, SessionUser } from '../../shared/domain';
import { canSeeAgency, isReviewer, validDate, localDate } from '../../shared/surplus';
function reject(message: string) {
    throw Object.assign(new Error(message), { statusCode: 400 });
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
        steps.push(
            db
                .prepare(
                    `INSERT OR IGNORE INTO surplus_reports(id,submission_id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                )
                .bind(
                    `${id}:${index}`,
                    id,
                    String(index),
                    request.agencyId,
                    row.productName.trim().replace(/\s+/g, ' '),
                    row.productForm,
                    (row.flavor ?? '').trim().replace(/\s+/g, ' '),
                    row.expirationDate ?? '',
                    row.units,
                    id,
                    user.id,
                    localDate(),
                    user.name,
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
    const id = crypto.randomUUID();
    await db
        .prepare(
            'INSERT INTO surplus_forecasts(id,agency_id,request_ref,formula_name,form,flavor,expected_units,due_date,actor_id) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .bind(
            id,
            b.agencyId,
            b.requestRef.trim(),
            b.formulaName.trim().replace(/\s+/g, ' '),
            b.form,
            (b.flavor ?? '').trim().replace(/\s+/g, ' '),
            b.expectedUnits,
            b.dueDate,
            user.id,
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
    const id = crypto.randomUUID();
    await db.batch([
        db
            .prepare(
                "INSERT INTO surplus_guard(ok) SELECT CASE WHEN status='awaiting-count' THEN 1 ELSE 0 END FROM surplus_forecasts WHERE id=?",
            )
            .bind(f.id),
        db
            .prepare(
                'INSERT INTO surplus_reports(id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name,reason,forecast_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            )
            .bind(
                id,
                id,
                f.agency_id,
                f.formula_name,
                f.form,
                f.flavor,
                b.expirationDate,
                b.quantity,
                f.request_ref,
                user.id,
                b.date,
                b.confirmerName,
                b.reason ?? '',
                f.id,
            ),
        db
            .prepare("UPDATE surplus_forecasts SET status='pending-review',actual_units=?,report_id=? WHERE id=?")
            .bind(b.quantity, id, f.id),
        db.prepare('DELETE FROM surplus_guard'),
    ]);
    return { id };
}
