import { requireAdmin } from '../../../utils/authorization';
import { getSessionFromHeaders } from '../../../utils/session';
import { denyAccessRequest } from '../../../utils/accessStore';

export default defineEventHandler(async (event) => {
    requireAdmin(getSessionFromHeaders(getRequestHeaders(event)));
    const body = await readBody<{ reason?: string }>(event);
    if (!body?.reason?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'A denial reason is required.' });
    }

    return { request: denyAccessRequest(Number(getRouterParam(event, 'id')), body.reason.trim()) };
});
