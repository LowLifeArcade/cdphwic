import { getRequestById } from '../../../utils/requestStore';

export default defineEventHandler(async (event) => {
    const request = getRequestById(Number(getRouterParam(event, 'id')));
    const attachment = request?.prescriptionAttachment;
    const environment = event.context.cloudflare?.env as Env | undefined;
    if (!request || !attachment || !environment?.PRESCRIPTIONS) {
        throw createError({ statusCode: 404, statusMessage: 'Submitted prescription not found.' });
    }

    const object = await environment.PRESCRIPTIONS.get(attachment.storageKey);
    if (!object?.body) {
        throw createError({ statusCode: 404, statusMessage: 'Submitted prescription not found.' });
    }

    setResponseHeader(event, 'content-type', attachment.contentType);
    setResponseHeader(event, 'content-disposition', `inline; filename="${attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '-') }"`);
    setResponseHeader(event, 'cache-control', 'private, no-store');
    return object.body;
});
