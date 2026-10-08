export default defineEventHandler(async (event) => {
    const body = await readBody<{ key?: string }>(event);
    const environment = event.context.cloudflare?.env as Env | undefined;
    if (!environment?.PRESCRIPTIONS || !body?.key || !body.key.startsWith(`temporary/${environment.ENV}/`)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid prescription upload.' });
    }

    await environment.PRESCRIPTIONS.delete(body.key);
    return { deleted: true };
});
