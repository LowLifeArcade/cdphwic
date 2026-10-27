import { deleteAccessibleRequestDraft } from '../../../utils/requestDraftStore';
import { getSessionFromHeaders } from '../../../utils/session';
export default defineEventHandler(async (event) => {
    const env = event.context.cloudflare?.env as Env | undefined;
    if (!env?.PRESCRIPTIONS) throw createError({statusCode:503,statusMessage:'Deleting incomplete requests is unavailable.'});
    const user = getSessionFromHeaders({'x-demo-user':getHeader(event,'x-demo-user')});
    try {
        await deleteAccessibleRequestDraft(env.PRESCRIPTIONS,env.ENV,user,Number(getRouterParam(event,'id')));
    } catch (error) {
        if ((error as {statusCode?:number}).statusCode === 404) throw createError({statusCode:404,statusMessage:'Incomplete request not found.'});
        throw error;
    }
    return {deleted:true};
});
