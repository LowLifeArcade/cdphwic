import { createProduct, type ProductInput } from '../../utils/productStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<ProductInput>(event);
    return { product: createProduct(body) };
});
