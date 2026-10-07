import { requireAdmin } from '../utils/authorization';
import { getDemoUser } from '../utils/session';
import { createInvitation } from '../utils/accessStore';

export default defineEventHandler(async (event) => {
    requireAdmin(getDemoUser('admin'));
    const body = await readBody<{ email?: string; memberType?: string; agencyId?: number }>(event);
    if (!body?.email) {
        throw createError({ statusCode: 400, statusMessage: 'Email is required.' });
    }
    const invitation = createInvitation({
        email: body.email,
        invitationType: body.memberType === 'internal' ? 'staff' : 'agency_rep',
        agencyId: body.agencyId,
    });
    return { message: `Invitation prepared for ${body.email}.`, invitation, demo: true };
});
