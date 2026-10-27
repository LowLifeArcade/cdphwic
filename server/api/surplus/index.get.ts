import { defineEventHandler } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { listSurplus } from '../../utils/surplusStore';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    return { user, ...(await listSurplus(db, user)) };
});
