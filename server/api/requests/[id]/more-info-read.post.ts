import {submittedRequest,readVisibleMoreInfoMessages} from '../../../utils/submittedRequests';
import {getSessionFromHeaders} from '../../../utils/session';
export default defineEventHandler(async event=>{
 const db=event.context.cloudflare?.env?.CDPHWIC as D1Database|undefined;
 if(!db)throw createError({statusCode:503,statusMessage:'Request database unavailable.'});
 const user=getSessionFromHeaders({'x-demo-user':getHeader(event,'x-demo-user')});
 const previous=await submittedRequest(db,Number(getRouterParam(event,'id')),user);
 if(!previous)throw createError({statusCode:404,statusMessage:'Request not found.'});
 const body=await readBody<{noticeIds:string[];revision:number}>(event);
 return {request:await readVisibleMoreInfoMessages(db,previous,user,body.noticeIds,body.revision)};
});
