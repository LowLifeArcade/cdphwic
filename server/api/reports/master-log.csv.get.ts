import { listProducts } from '../../utils/productRepository';
import { productDatabase } from '../../utils/productDatabase';
import { getMasterLogExportRows } from '../../utils/reportStore';
import { csvResponse } from '../../utils/reportExport';

export default defineEventHandler(async (event) => csvResponse(event, getMasterLogExportRows(await listProducts(productDatabase(event), {includeInactive:true})), 'cdphwic-master-log.csv'));
