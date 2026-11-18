import { productDatabase } from '../../utils/productDatabase';
import { listProducts } from '../../utils/productRepository';

export default defineEventHandler(async (event) => ({ products: await listProducts(productDatabase(event)) }));
