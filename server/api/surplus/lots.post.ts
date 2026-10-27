import { defineEventHandler, readBody, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { ensureSurplusLot } from '../../utils/surplusStore';
import { isReviewer } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    if (!isReviewer(user)) throw createError({ statusCode: 403 });
    const b = await readBody(event);
    return ensureSurplusLot(db, b.agencyId, b);
});
