import type { DemoIdentity } from '../../../shared/demoIdentity';
import { findUserByEmail } from '../../utils/accessStore';

export default defineEventHandler(async (event) => {
    if (getHeader(event, 'x-demo-user') !== 'admin') {
        throw createError({ statusCode: 403, statusMessage: 'Admin access required.' });
    }

    const body = await readBody<{ email?: string }>(event);
    const user = body?.email ? findUserByEmail(body.email) : undefined;
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'No user found for that email.' });
    }

    const identity: DemoIdentity =
        user.role === 'admin' ? 'admin' : user.memberType === 'agency' ? 'agency' : 'internal';
    return { identity, user };
});
