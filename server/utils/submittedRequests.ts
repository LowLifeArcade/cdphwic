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
export async function updateSubmittedRequest(db: D1Database, previous: RequestRecord, updates: Partial<RequestRecord>) {
    const request = {
        ...previous,
        ...updates,
        id: previous.id,
        submissionId: previous.submissionId,
        agencyId: previous.agencyId,
        agencyMemberId: previous.agencyMemberId,
    };
    await db
        .prepare('UPDATE surplus_submissions SET request_json=? WHERE id=? AND agency_id=?')
        .bind(JSON.stringify(request), previous.submissionId, previous.agencyId)
        .run();
    return request;
}
