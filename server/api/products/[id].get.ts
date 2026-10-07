import { getProduct } from '../../utils/productStore';

export default defineEventHandler((event) => {
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isInteger(id)) {
        throw createError({ statusCode: 400, statusMessage: 'A valid product ID is required.' });
    }

    try {
        return { product: getProduct(id) };
    } catch (error) {
        throw createError({ statusCode: 404, statusMessage: (error as Error).message });
    }
});
