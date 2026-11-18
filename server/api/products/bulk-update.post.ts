import { productDatabase } from '../../utils/productDatabase';
import { ProductUploadError, productUploadSummary } from '../../../shared/productUploadErrors';
import { parseProductUpdateWorkbook } from '../../utils/productImport';
import { updateCatalogProducts } from '../../utils/productRepository';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'file');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Choose a CSV or Excel file.' });
    }

    try {
        const updates = parseProductUpdateWorkbook(file.data);
        const products = await updateCatalogProducts(productDatabase(event), updates);
        return { products, count: products.length };
    } catch (error) {
        throw createError({ statusCode: (error as {statusCode?:number}).statusCode ?? 400, statusMessage: 'Product update needs corrections.', data: { message: error instanceof ProductUploadError ? productUploadSummary(error.issues) : (error as Error).message, issues: error instanceof ProductUploadError ? error.issues : [] } });
    }
});
