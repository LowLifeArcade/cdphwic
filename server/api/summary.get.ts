import { listProducts } from '../utils/productRepository';
import { productDatabase } from '../utils/productDatabase';
import { buildSummary } from '../utils/summary';

export default defineEventHandler(async (event) => ({
    summary: buildSummary(await listProducts(productDatabase(event), {includeInactive:true})),
    filters: { categories: ['standard', 'exempt', 'nutritional'], dateRanges: ['YTD', 'Last 30 days', 'Last 90 days'] },
}));
