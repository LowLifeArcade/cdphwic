import { requireAdmin } from '../../utils/authorization';
import { getSessionFromHeaders } from '../../utils/session';
import { listAccessRequests } from '../../utils/accessStore';

export default defineEventHandler((event) => {
    requireAdmin(getSessionFromHeaders(getRequestHeaders(event)));
    return { requests: listAccessRequests() };
});
