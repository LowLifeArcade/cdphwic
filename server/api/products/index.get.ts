import { listProducts } from '../../utils/productStore';

export default defineEventHandler(() => ({ products: listProducts() }));
