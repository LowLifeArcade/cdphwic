import * as XLSX from 'xlsx';
import { createProducts, type ProductInput } from '../../utils/productStore';
import type { ProductCoverage } from '../../../shared/domain';

type ProductImportRow = Partial<ProductInput> & { coverage?: string | ProductCoverage[] };

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'file');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Choose a CSV or Excel file.' });
    }

    try {
        const workbook = XLSX.read(file.data, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ProductImportRow>(firstSheet, { defval: '' });
        const products = createProducts(
            rows.map((row) => ({
                ...row,
                coverage:
                    typeof row.coverage === 'string'
                        ? (row.coverage
                              .split(/[\s,]+/)
                              .map((coverage) => coverage.trim().toLowerCase())
                              .filter(Boolean) as ProductCoverage[])
                        : row.coverage,
            })) as ProductInput[],
        );
        return { products, count: products.length };
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
