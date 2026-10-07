import { requireAdmin } from '../../utils/authorization';
import { getSessionFromHeaders } from '../../utils/session';
import { createAgency } from '../../utils/accessStore';

export default defineEventHandler(async (event) => {
    requireAdmin(getSessionFromHeaders(getRequestHeaders(event)));
    const body = await readBody<{
        name?: string;
        shippingAddress?: string;
        city?: string;
        state?: string;
        postalCode?: string;
    }>(event);
    if (!body?.name || !body.shippingAddress || !body.city || !body.state || !body.postalCode)
        throw createError({ statusCode: 400, statusMessage: 'Agency name and shipping address are required.' });
    return {
        agency: createAgency({
            name: body.name,
            shippingAddress: body.shippingAddress,
            city: body.city,
            state: body.state,
            postalCode: body.postalCode,
        }),
    };
});
