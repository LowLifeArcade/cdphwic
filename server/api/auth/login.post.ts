import { findUserByEmail } from '../../utils/accessStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ email?: string; password?: string }>(event);
    if (!body?.email || !body.password)
        throw createError({ statusCode: 400, statusMessage: 'Email and password are required.' });
    const user = findUserByEmail(body.email);
    if (!user) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' });
    return { user, demo: true, message: 'Development password check accepted.' };
});
