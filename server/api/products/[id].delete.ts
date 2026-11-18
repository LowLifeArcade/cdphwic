import { productDatabase } from '../../utils/productDatabase';
import { deleteProduct } from '../../utils/productRepository';
import { getSessionFromHeaders } from '../../utils/session';
import { isReviewer } from '../../../shared/surplus';

export default defineEventHandler(async (event) => {
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    if (!isReviewer(user)) throw createError({ statusCode: 403, statusMessage: 'Only CDPH/WIC or Admin can delete products.' });
    const id = Number(getRouterParam(event, 'id'));
    if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'A valid product ID is required.' });
    try {
        return { product: await deleteProduct(productDatabase(event), id) };
    } catch (error) {
        throw createError({ statusCode: (error as {statusCode?:number}).statusCode ?? 404, statusMessage: (error as Error).message });
    }
});
