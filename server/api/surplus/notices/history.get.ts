import { defineEventHandler } from 'h3';
import { archiveNotification, type ArchivedNotification } from '../../../../shared/notificationHistory';
import { surplusContext } from '../../../utils/surplusContext';
import { listSurplusNotices } from '../../../utils/surplusNotices';

export default defineEventHandler(async event => {
    const { db, user } = surplusContext(event);
    const { results } = await db.prepare(
        'SELECT notice_id,read_at,notice_snapshot FROM surplus_notice_reads WHERE user_id=? ORDER BY read_at DESC, rowid DESC',
    ).bind(user.id).all<{ notice_id: string; read_at: string; notice_snapshot: string | null }>();
    const active = new Map(results.some(row => !row.notice_snapshot)
        ? (await listSurplusNotices(db, user)).map(notice => [notice.id, notice] as const)
        : []);
    return {
        notifications: results.flatMap(row => {
            const current = active.get(row.notice_id);
            const snapshot = row.notice_snapshot ? JSON.parse(row.notice_snapshot) as ArchivedNotification
                : current ? archiveNotification(current) : undefined;
            return snapshot ? [{ ...snapshot, readAt: row.read_at }] : [];
        }),
    };
});
