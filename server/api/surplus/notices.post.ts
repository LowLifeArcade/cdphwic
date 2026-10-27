import { defineEventHandler, readBody, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { listSurplusNotices } from '../../utils/surplusNotices';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const b = await readBody(event);
    if (!(await listSurplusNotices(db, user)).some((n) => n.id === b.noticeId)) throw createError({ statusCode: 404 });
    await db
        .prepare('INSERT OR IGNORE INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)')
        .bind(b.noticeId, user.id)
        .run();
    return { ok: true };
});
