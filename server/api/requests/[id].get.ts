import { getRequestById } from '../../utils/requestStore';
import { submittedRequest } from '../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../utils/session';
import { canSeeAgency } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    const request = (env?.CDPHWIC ? await submittedRequest(env.CDPHWIC, id, user) : undefined) ?? getRequestById(id);
    if (!request || !canSeeAgency(user, request.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    return { request };
});
