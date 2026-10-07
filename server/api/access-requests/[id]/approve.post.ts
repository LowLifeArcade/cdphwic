import { requireAdmin } from '../../../utils/authorization';
import { getSessionFromHeaders } from '../../../utils/session';
import { approveAccessRequest } from '../../../utils/accessStore';

export default defineEventHandler(async (event) => {
    requireAdmin(getSessionFromHeaders(getRequestHeaders(event)));
    const body = await readBody<{ invitationType?: 'agency_rep' | 'staff'; agencyId?: number }>(event);
    const result = approveAccessRequest(
        Number(getRouterParam(event, 'id')),
        body?.invitationType ?? 'agency_rep',
        body?.agencyId,
    );
    return { invitation: result, message: `Invitation link prepared: ${result.url}` };
});
