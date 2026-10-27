import { submittedRequest } from '../../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../../utils/session';
import { canSeeAgency } from '../../../../shared/surplus';
import { getRequestById } from '../../../utils/requestStore';

export default defineEventHandler(async (event) => {
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    const id = Number(getRouterParam(event, 'id'));
    const request = (env?.CDPHWIC ? await submittedRequest(env.CDPHWIC, id, user) : undefined) ?? getRequestById(id);
    if (request && !canSeeAgency(user, request.agencyId)) throw createError({ statusCode: 404 });
    const attachment = request?.prescriptionAttachment;
    const environment = event.context.cloudflare?.env as Partial<Env> | undefined;
    if (!request || !attachment || !environment?.PRESCRIPTIONS) {
        throw createError({ statusCode: 404, statusMessage: 'Submitted prescription not found.' });
    }

    const object = await environment.PRESCRIPTIONS.get(attachment.storageKey);
    if (!object?.body) {
        throw createError({ statusCode: 404, statusMessage: 'Submitted prescription not found.' });
    }

    setResponseHeader(event, 'content-type', attachment.contentType);
    setResponseHeader(
        event,
        'content-disposition',
        `inline; filename="${attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}"`,
    );
    setResponseHeader(event, 'cache-control', 'private, no-store');
    return object.body;
});
