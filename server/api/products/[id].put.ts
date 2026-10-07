import { updateProduct, type ProductInput } from '../../utils/productStore';

export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isInteger(id)) {
        throw createError({ statusCode: 400, statusMessage: 'A valid product ID is required.' });
    }

    try {
        const body = await readBody<ProductInput>(event);
        return { product: updateProduct(id, body) };
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
