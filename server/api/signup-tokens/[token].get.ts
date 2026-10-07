import { getTokenPreview } from '../../utils/accessStore';

export default defineEventHandler((event) => {
    const preview = getTokenPreview(getRouterParam(event, 'token') ?? '');
    if (!preview || preview.used || Date.parse(preview.expiresAt) <= Date.now()) {
        throw createError({ statusCode: 404, statusMessage: 'Invitation is invalid or expired.' });
    }

    return { invitation: { ...preview, email: undefined } };
});
