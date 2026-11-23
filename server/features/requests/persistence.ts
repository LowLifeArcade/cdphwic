import type { RequestRecord, SessionUser } from '../../../shared/domain';
import { hasPendingMoreInfo } from '../../../shared/requestEditing';
export async function submittedRequests(db: D1Database, user: SessionUser) {
    const rows = await db
        .prepare('SELECT request_json FROM surplus_submissions WHERE (?=1 OR agency_id=?)')
        .bind(user.role === 'admin' || user.memberType === 'internal' ? 1 : 0, user.agencyId ?? -1)
        .all<{
            request_json: string;
        }>();
    return rows.results.map((row) => JSON.parse(row.request_json) as RequestRecord);
}
export async function submittedRequest(db: D1Database, id: number, user: SessionUser) {
    return (await submittedRequests(db, user)).find((r) => r.id === id);
}
export async function ensureSubmittedRequest(db: D1Database, previous: RequestRecord) {
    const id = previous.submissionId ?? `legacy-${previous.id}`;
    const request = {
        ...previous,
        submissionId: id,
    };
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
export function conflict(
    message = 'This submission was changed or opened by Admin/FPU. Reload it before making further updates.',
) {
    return Object.assign(new Error(message), {
        statusCode: 409,
        statusMessage: message,
    });
}
export function nextRecord(previous: RequestRecord, updates: Partial<RequestRecord>) {
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
export async function writeRecord(
    db: D1Database,
    previous: RequestRecord,
    request: RequestRecord,
    unopened: boolean,
    extra: D1PreparedStatement[] = [],
) {
    if (
        hasPendingMoreInfo(previous) &&
        hasPendingMoreInfo({
            ...request,
            status: 'needs_info',
        })
    ) {
        request.status = 'needs_info';
    }
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
export function commitRequestTransfer(
    db: D1Database,
    previous: RequestRecord,
    updates: Partial<RequestRecord>,
    steps: D1PreparedStatement[],
) {
    return writeRecord(db, previous, nextRecord(previous, updates), false, steps);
}
