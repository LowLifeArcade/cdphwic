import type { RequestRecord } from '../../../shared/domain';
import { createRequestRecord } from '../../utils/requestStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<Omit<RequestRecord, 'id'>>(event);
    if (!body?.participantName || !body.productName || !body.agencyId || !body.agencyMemberId) {
        throw createError({ statusCode: 400, statusMessage: 'Participant, product, agency, and rep are required.' });
    }

    return { request: createRequestRecord({ ...body, status: body.status ?? 'pending' }), demo: true };
});
