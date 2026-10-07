import type { RequestScope } from '../../../shared/domain';
import { getRequestsForUser } from '../../utils/requestStore';
import { getSessionFromHeaders } from '../../utils/session';

export default defineEventHandler((event) => {
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const query = getQuery(event);
    const scope = query.scope === 'mine' ? 'mine' : ('all' satisfies RequestScope);
    const agencyId = query.agencyId ? Number(query.agencyId) : undefined;
    const repId = query.repId ? Number(query.repId) : undefined;
    return { user, scope, requests: getRequestsForUser(user, scope, { agencyId, repId }) };
});
