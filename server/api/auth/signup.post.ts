import type { MemberType, UserRole } from '../../../shared/domain';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ name?: string; email?: string; role?: UserRole; memberType?: MemberType }>(event);
    if (!body?.name || !body.email) {
        throw createError({ statusCode: 400, statusMessage: 'Name and email are required.' });
    }

    return {
        message: 'Signup recorded in development mode.',
        user: {
            name: body.name,
            email: body.email,
            role: body.role ?? 'member',
            memberType: body.memberType ?? 'agency',
        },
        demo: true,
    };
});
