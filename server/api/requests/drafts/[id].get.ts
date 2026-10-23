import { readRequestDraft, canAccessDraft } from '../../../utils/requestDraftStore';
import { getSessionFromHeaders } from '../../../utils/session';

export default defineEventHandler(async (event) => {
    const env = event.context.cloudflare?.env as Env | undefined;
    if (!env?.PRESCRIPTIONS) throw createError({ statusCode: 503, statusMessage: 'Incomplete requests are unavailable.' });
    const draft = await readRequestDraft(env.PRESCRIPTIONS, env.ENV, Number(getRouterParam(event, 'id')));
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    if (!draft || !canAccessDraft(draft, user)) throw createError({ statusCode: 404, statusMessage: 'Incomplete request not found.' });
    return draft;
});
