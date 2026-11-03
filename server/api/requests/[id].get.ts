import { getRequestById } from '../../utils/requestStore';
import { submittedRequest, ensureSubmittedRequest, updateSubmittedRequest } from '../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../utils/session';
import { canSeeAgency, isReviewer } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    let request = (env?.CDPHWIC ? await submittedRequest(env.CDPHWIC, id, user) : undefined) ?? getRequestById(id);
    if (!request || !canSeeAgency(user, request.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    if (isReviewer(user) && request.status === 'unopened') {
        if (!env?.CDPHWIC) throw createError({statusCode:503,statusMessage:'Request database unavailable.'});
        const previous = await ensureSubmittedRequest(env.CDPHWIC, request);
        request = await updateSubmittedRequest(env.CDPHWIC, previous, {status:'opened'});
    }
    return { request };
});
