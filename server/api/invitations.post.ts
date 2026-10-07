import { requireAdmin } from '../utils/authorization';
import { getDemoUser } from '../utils/session';

export default defineEventHandler(async (event) => {
    requireAdmin(getDemoUser('admin'));
    const body = await readBody<{ email?: string; memberType?: string; agencyId?: number }>(event);
    if (!body?.email) {
        throw createError({ statusCode: 400, statusMessage: 'Email is required.' });
    }
    return {
        message: `Invitation prepared for ${body.email}.`,
        invitation: { ...body, status: 'pending' },
        demo: true,
    };
});
