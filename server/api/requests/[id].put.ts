import type { RequestRecord } from '../../../shared/domain';
import { getRequestById, updateRequestRecord } from '../../utils/requestStore';
import { submittedRequest, updateSubmittedRequest } from '../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../utils/session';
import { canSeeAgency } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const updates = await readBody<Partial<RequestRecord>>(event);
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    const saved = env?.CDPHWIC ? await submittedRequest(env.CDPHWIC, id, user) : undefined;
    const previous = saved ?? getRequestById(id);
    if (!previous || !canSeeAgency(user, previous.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    const safe = {
        ...updates,
        id: previous.id,
        agencyId: previous.agencyId,
        agencyMemberId: previous.agencyMemberId,
        submissionId: previous.submissionId,
    };
    const request = saved ? await updateSubmittedRequest(env!.CDPHWIC!, saved, safe) : updateRequestRecord(id, safe);
    return { request, demo: true };
});
