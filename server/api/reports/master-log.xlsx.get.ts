import { listProducts } from '../../utils/productRepository';
import { productDatabase } from '../../utils/productDatabase';
import { getMasterLogExportRows } from '../../utils/reportStore';
import { xlsxResponse } from '../../utils/reportExport';

export default defineEventHandler(async (event) =>
    xlsxResponse(event, getMasterLogExportRows(await listProducts(productDatabase(event), {includeInactive:true})), 'Master Log', 'cdphwic-master-log.xlsx'),
);
