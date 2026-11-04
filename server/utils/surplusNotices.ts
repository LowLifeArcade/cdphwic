import {requestNotices} from './requestNotices';
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
    // Each handoff has its own read identity; reservation notices are immediate.
    const transfers=await db.prepare(`SELECT t.*,t.id AS transfer_id,t.source_agency_id AS agency_id,
        CASE WHEN EXISTS(SELECT 1 FROM transfer_shipping_labels s WHERE s.transfer_id=t.id) THEN 1 ELSE 0 END AS has_labels
        FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id
        WHERE t.request_id IS NOT NULL AND t.status='reserved' AND (?=1 OR t.source_agency_id=?)
        AND l.expiration_date>=? AND l.expired_units=0 ORDER BY t.rowid DESC`)
        .bind(isReviewer(user)?1:0,user.agencyId??-1,today).all<any>();
    const reads=await db.prepare('SELECT notice_id FROM surplus_notice_reads WHERE user_id=?').bind(user.id).all<{notice_id:string}>();
    const seen=new Set(reads.results.map(row=>row.notice_id));
    const transferNotices=transfers.results.flatMap(t=>{
        const ready=!!(t.eta&&t.tracking_reference&&t.has_labels);
        const kind=isReviewer(user)?(t.stock_confirmed_at&&!ready?'transfer-confirmed':null)
            :user.memberType==='agency'?(!t.stock_confirmed_at?'transfer-stock':ready?'transfer-ready':null):null;
        if(!kind)return [];
        const id=`${kind}:${t.id}`;
        const title=kind==='transfer-stock'?'Reserved Formula — Confirm Product Availability'
            :kind==='transfer-confirmed'?'Agency Confirmed Stock — Provide Shipping Labels'
            :'Shipping Labels Ready — Arrange Pickup';
        return [{...t,id,kind,title,notes:kind==='transfer-confirmed'
            ?`The sending Local Agency confirmed ${t.quantity} unit(s) of ${t.formula_name}. Provide shipping labels and send the shipping details.`
            :kind==='transfer-stock'?'Confirm that your agency physically has the reserved formula and quantity.'
            :'Download and print the labels provided by CDPH/WIC, arrange carrier pickup, then confirm pickup after collection.',is_read:seen.has(id)?1:0}];
    });
    return [
        ...await requestNotices(db,user),
        ...transferNotices,
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
