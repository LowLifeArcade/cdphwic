import { listProducts } from '../../utils/productRepository';
import { productDatabase } from '../../utils/productDatabase';
import { getMasterLogRows, MASTER_LOG_MONTHS } from '../../utils/reportStore';

export default defineEventHandler(async (event) => ({ months: MASTER_LOG_MONTHS, rows: getMasterLogRows(await listProducts(productDatabase(event), {includeInactive:true})) }));
