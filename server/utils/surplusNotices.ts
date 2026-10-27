import { localDate, daysRemaining, isReviewer } from '../../shared/surplus';
import type { SessionUser } from '../../shared/domain';
import { expireSurplusLots } from './surplusStore';
export async function refreshSurplusNotices(db: D1Database, today = localDate()) {
    await expireSurplusLots(db, today);
    const lots = await db.prepare('SELECT * FROM surplus_lots WHERE on_hand>0 OR expired_units>0').all<any>();
    for (const lot of lots.results) {
        const kind =
            lot.expired_units > 0 && daysRemaining(lot.expiration_date, today) < 0
                ? 'destruction'
                : lot.on_hand > 0 && daysRemaining(lot.expiration_date, today) >= 60
                  ? 'donation'
                  : undefined;
        if (kind)
            await db
                .prepare(
                    'INSERT OR IGNORE INTO surplus_notices(id,agency_id,lot_id,kind,expiration_date) VALUES(?,?,?,?,?)',
                )
                .bind(crypto.randomUUID(), lot.agency_id, lot.id, kind, lot.expiration_date)
                .run();
    }
}
export async function listSurplusNotices(db: D1Database, user: SessionUser) {
    await refreshSurplusNotices(db);
    const today = localDate();
    const rows = await db
        .prepare(
            `SELECT n.*,l.formula_name,l.form,l.flavor,l.on_hand,l.reserved,l.expired_units,CASE WHEN r.notice_id IS NULL THEN 0 ELSE 1 END AS is_read FROM surplus_notices n JOIN surplus_lots l ON l.id=n.lot_id LEFT JOIN surplus_notice_reads r ON r.notice_id=n.id AND r.user_id=? WHERE (?=1 OR n.agency_id=?) AND n.expiration_date=l.expiration_date ORDER BY n.created_at DESC`,
        )
        .bind(user.id, isReviewer(user) ? 1 : 0, user.agencyId ?? -1)
        .all<any>();
    const notices = rows.results.filter((n) =>
        n.kind === 'donation'
            ? n.on_hand > 0 && daysRemaining(n.expiration_date, today) >= 60
            : n.expired_units > 0 && daysRemaining(n.expiration_date, today) < 0,
    );
    const forecasts = await db
        .prepare(
            `SELECT f.*,CASE WHEN r.notice_id IS NULL THEN 0 ELSE 1 END AS is_read FROM surplus_forecasts f LEFT JOIN surplus_notice_reads r ON r.notice_id=('forecast:'||f.id) AND r.user_id=? WHERE status='awaiting-count' AND (?=1 OR agency_id=?) ORDER BY due_date`,
        )
        .bind(user.id, isReviewer(user) ? 1 : 0, user.agencyId ?? -1)
        .all<any>();
    return [
        ...notices,
        ...forecasts.results.map((f) => ({
            ...f,
            id: `forecast:${f.id}`,
            kind: 'forecast',
            expiration_date: '',
            on_hand: 0,
            reserved: 0,
            expired_units: 0,
        })),
    ];
}
