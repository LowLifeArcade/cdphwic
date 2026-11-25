import { archiveNotification } from '../../../shared/notificationHistory';
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
        .prepare('INSERT INTO surplus_notice_reads(notice_id,user_id,notice_snapshot) VALUES(?,?,?) ON CONFLICT(notice_id,user_id) DO UPDATE SET notice_snapshot=COALESCE(surplus_notice_reads.notice_snapshot,excluded.notice_snapshot)')
        .bind(b.noticeId, user.id, JSON.stringify(archiveNotification(notice)))
        .run();
    return { ok: true };
});
