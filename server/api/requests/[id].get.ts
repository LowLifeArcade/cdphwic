import { getRequestById } from '../../utils/requestStore';

export default defineEventHandler((event) => {
    const request = getRequestById(Number(getRouterParam(event, 'id')));
    if (!request) {
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    }

    return { request };
});
