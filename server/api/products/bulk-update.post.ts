import * as XLSX from 'xlsx';
import { updateProducts, type ProductQuantityUpdate } from '../../utils/productStore';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'file');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Choose a CSV or Excel file.' });
    }

    try {
        const workbook = XLSX.read(file.data, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Partial<ProductQuantityUpdate>>(firstSheet, { defval: '' });
        const updates = rows.map((row) => ({
            productId: String(row.productId ?? '').trim(),
            casesApproved: Number(row.casesApproved),
            casesUsed: Number(row.casesUsed),
        }));
        const products = updateProducts(updates);
        return { products, count: products.length };
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
