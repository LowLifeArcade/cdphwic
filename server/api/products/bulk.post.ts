import { createProducts } from '../../utils/productStore';
import { parseProductWorkbook } from '../../utils/productImport';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'file');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Choose a CSV or Excel file.' });
    }
    try {
        const products = createProducts(parseProductWorkbook(file.data));
        return { products, count: products.length };
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
