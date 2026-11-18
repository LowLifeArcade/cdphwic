import { productDatabase } from '../../utils/productDatabase';
import { updateProduct } from '../../utils/productRepository';
import type { ProductInput } from '../../utils/productValidation';

export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isInteger(id)) {
        throw createError({ statusCode: 400, statusMessage: 'A valid product ID is required.' });
    }

    try {
        const body = await readBody<ProductInput>(event);
        return { product: await updateProduct(productDatabase(event), id, body) };
    } catch (error) {
        throw createError({ statusCode: (error as {statusCode?:number}).statusCode ?? 400, statusMessage: (error as Error).message });
    }
});
