import { submittedRequests } from '../../utils/submittedRequests';
import { listRequestDrafts } from '../../utils/requestDraftStore';
import { filterRequestsByScope } from '../../../shared/requestScope';
import type { RequestScope } from '../../../shared/domain';
import { getRequestsForUser } from '../../utils/requestStore';
import { getSessionFromHeaders } from '../../utils/session';

export default defineEventHandler(async (event) => {
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const query = getQuery(event);
    const scope = query.scope === 'mine' ? 'mine' : ('all' satisfies RequestScope);
    const agencyId = query.agencyId ? Number(query.agencyId) : undefined;
    const repId = query.repId ? Number(query.repId) : undefined;
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    const drafts = env?.PRESCRIPTIONS ? await listRequestDrafts(env.PRESCRIPTIONS, env.ENV, user) : [];
    const durable = env?.CDPHWIC ? await submittedRequests(env.CDPHWIC, user) : [];
    const durableIds = new Set(durable.map(r => r.id));
    return { user, scope, requests: [
        ...filterRequestsByScope(drafts, user, scope, { agencyId, repId }),
        ...filterRequestsByScope(durable,user,scope,{agencyId,repId}),
        ...getRequestsForUser(user, scope, { agencyId, repId }).filter(r=>!durableIds.has(r.id)),
    ] };
});
