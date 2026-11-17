import { createError, defineEventHandler, readBody } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { executeSurplusCommand } from '../../utils/surplusStore';
import { isReviewer } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const command=await readBody(event);
    if(isReviewer(user)&&command?.kind==='reconcile'&&!command.reportId)
        throw createError({statusCode:403,statusMessage:'Physical counts must be submitted by the Local Agency.'});
    return executeSurplusCommand(db, user, command);
});
