import { saveRequestDraft, type DraftValues } from '../../../utils/requestDraftStore';
import { getSessionFromHeaders } from '../../../utils/session';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ id?: number; form?: DraftValues; prescriptionKey?: string; fileName?: string }>(event);
    const env = event.context.cloudflare?.env as Env | undefined;
    if (!env?.PRESCRIPTIONS) throw createError({ statusCode: 503, statusMessage: 'Saving incomplete requests is unavailable.' });
    if (!body?.form || typeof body.form !== 'object' || Array.isArray(body.form) || Object.keys(body.form).length > 80 ||
        Object.values(body.form).some((value) => !['string', 'number', 'boolean'].includes(typeof value)) || JSON.stringify(body.form).length > 100_000) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid request form.' });
    }
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    try {
        const draft = await saveRequestDraft(env.PRESCRIPTIONS, env.ENV, user, { ...body, form: body.form });
        return { request: draft.request };
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
