import { productDatabase } from '../../utils/productDatabase';
import { getProduct } from '../../utils/productRepository';

export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isInteger(id)) {
        throw createError({ statusCode: 400, statusMessage: 'A valid product ID is required.' });
    }

    try {
        return { product: await getProduct(productDatabase(event), id) };
    } catch (error) {
        throw createError({ statusCode: (error as {statusCode?:number}).statusCode ?? 404, statusMessage: (error as Error).message });
    }
});
