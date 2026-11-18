import { productDatabase } from '../../utils/productDatabase';
import { createProduct } from '../../utils/productRepository';
import type { ProductInput } from '../../utils/productValidation';

export default defineEventHandler(async (event) => {
    const body = await readBody<ProductInput>(event);
    return { product: await createProduct(productDatabase(event), body) };
});
