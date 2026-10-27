import { defineEventHandler, readBody } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { executeSurplusCommand } from '../../utils/surplusStore';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    return executeSurplusCommand(db, user, await readBody(event));
});
