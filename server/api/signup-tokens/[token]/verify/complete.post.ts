import { completeVerification } from '../../../../utils/accessStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ code?: string }>(event);
    try {
        return completeVerification(getRouterParam(event, 'token') ?? '', body?.code ?? '');
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
