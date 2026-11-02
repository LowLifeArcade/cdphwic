import {submittedRequest,markMoreInfoRead} from '../../utils/submittedRequests';
import { defineEventHandler, readBody, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { listSurplusNotices } from '../../utils/surplusNotices';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const b = await readBody(event);
    const notice=(await listSurplusNotices(db,user)).find(n=>n.id===b.noticeId);
    if(!notice)throw createError({statusCode:404});
    if((notice.kind==='request-info'||notice.kind==='request-response')&&notice.request_id){const request=await submittedRequest(db,notice.request_id,user);if(request)await markMoreInfoRead(db,request,user,b.noticeId);}
    await db
        .prepare('INSERT OR IGNORE INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)')
        .bind(b.noticeId, user.id)
        .run();
    return { ok: true };
});
