import type { RequestRecord } from '../../../shared/domain';
import { updateRequestRecord } from '../../utils/requestStore';

export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const updates = await readBody<Partial<RequestRecord>>(event);
    const request = updateRequestRecord(id, updates ?? {});
    if (!request) {
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    }

    return { request, demo: true };
});
