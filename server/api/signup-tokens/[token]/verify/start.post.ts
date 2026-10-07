import { startVerification } from '../../../../utils/accessStore';

export default defineEventHandler((event) => {
    try {
        const result = startVerification(getRouterParam(event, 'token') ?? '');
        return process.env.NODE_ENV === 'production'
            ? { maskedEmail: result.maskedEmail, expiresAt: result.expiresAt }
            : result;
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
