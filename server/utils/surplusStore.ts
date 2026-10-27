import type { SurplusReport, SurplusForecast, SurplusTransfer, SurplusMovement } from '../../shared/surplus';
import { SEED_AGENCIES } from '../data/seed';
import type { SessionUser } from '../../shared/domain';
import {
    canSeeAgency,
    isReviewer,
    localDate,
    validDate,
    variantKey,
    type SurplusCommand,
    type SurplusLot,
    type SurplusVariant,
} from '../../shared/surplus';
const columns =
    'id,agency_id AS agencyId,formula_name AS formulaName,form,flavor,expiration_date AS expirationDate,on_hand AS onHand,reserved,expired_units AS expiredUnits,version';
function fail(message: string) {
    throw Object.assign(new Error(message), { statusCode: 409 });
}
export async function ensureSurplusLot(db: D1Database, agencyId: number, v: SurplusVariant): Promise<SurplusLot> {
    if (
        !SEED_AGENCIES.some((a) => a.id === agencyId) ||
        !['powder', 'concentrate', 'ready-to-feed'].includes(v.form) ||
        !Number.isSafeInteger(agencyId) ||
        !v.formulaName?.trim() ||
        !v.form?.trim() ||
        !validDate(v.expirationDate)
    )
        fail('Agency, formula, form and valid expiration date are required.');
    await db
        .prepare(
            'INSERT OR IGNORE INTO surplus_lots(id,agency_id,variant_key,formula_name,form,flavor,expiration_date) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
            crypto.randomUUID(),
            agencyId,
            variantKey(v),
            v.formulaName.trim().replace(/\s+/g, ' '),
            v.form,
            v.flavor.trim().replace(/\s+/g, ' '),
            v.expirationDate,
        )
        .run();
    return (await db
        .prepare(`SELECT ${columns} FROM surplus_lots WHERE agency_id=? AND variant_key=?`)
        .bind(agencyId, variantKey(v))
        .first<SurplusLot>())!;
}
export async function executeSurplusCommand(
    db: D1Database,
    user: SessionUser,
    c: SurplusCommand,
    today = localDate(),
): Promise<{ operationId: string; lotId: string; transferId?: string }> {
    if (!isReviewer(user)) throw Object.assign(new Error('Admin or FPU access required.'), { statusCode: 403 });
    if (!c.operationId || !c.lotId) fail('An operation ID and lot are required.');
    const payload = JSON.stringify(c);
    const prior = await db.prepare('SELECT * FROM surplus_commands WHERE id=?').bind(c.operationId).first<any>();
    if (prior) {
        if (prior.payload !== payload || prior.actor_id !== user.id) fail('Operation ID already used.');
        return JSON.parse(prior.result);
    }
    if (c.kind !== 'expire') await expireSurplusLots(db, today);
    const lot = await db.prepare(`SELECT ${columns} FROM surplus_lots WHERE id=?`).bind(c.lotId).first<SurplusLot>();
    if (!lot) fail('Inventory lot not found.');
    const pending = "EXISTS(SELECT 1 FROM surplus_commands WHERE id=? AND status='pending')";
    const steps: D1PreparedStatement[] = [
        db
            .prepare('INSERT OR IGNORE INTO surplus_commands(id,actor_id,payload) VALUES(?,?,?)')
            .bind(c.operationId, user.id, payload),
    ];
    const guard = (condition: string, args: unknown[] = []) =>
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_guard(ok) SELECT CASE WHEN (${condition}) THEN 1 ELSE 0 END WHERE ${pending}`,
                )
                .bind(...args, c.operationId),
        );
    const update = (set: string, args: unknown[] = [], id = c.lotId) =>
        steps.push(
            db
                .prepare(`UPDATE surplus_lots SET ${set},version=version+1 WHERE id=? AND ${pending}`)
                .bind(...args, id, c.operationId),
        );
    guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=?)', [lot!.id, lot!.version]);
    let transferId = c.transferId;
    let movementLot = c.lotId;
    let quantity = c.quantity ?? 0;
    if (
        ['reconcile', 'deduct', 'reserve'].includes(c.kind) &&
        (!Number.isSafeInteger(quantity) || quantity < 0 || (c.kind !== 'reconcile' && quantity === 0))
    )
        fail('Enter a valid whole number of units.');
    if (c.kind === 'reconcile') {
        if (!c.reason?.trim() || !Number.isInteger(c.expectedVersion))
            fail('A reason and current inventory version are required.');
        guard(
            'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND reserved<=? AND (expired_units=0 OR expiration_date<?))',
            [lot!.id, c.expectedVersion, quantity, today],
        );
        update(
            'on_hand=CASE WHEN expiration_date<? THEN 0 ELSE ? END,expired_units=CASE WHEN expiration_date<? THEN ? ELSE 0 END',
            [today, quantity, today, quantity],
        );
        if (c.reportId) {
            guard(
                "EXISTS(SELECT 1 FROM surplus_reports WHERE id=? AND status='pending' AND agency_id=? AND reported_units=? AND lower(formula_name)=lower(?) AND form=? AND lower(flavor)=lower(?) AND (expiration_date=? OR expiration_date=''))",
                [c.reportId, lot!.agencyId, quantity, lot!.formulaName, lot!.form, lot!.flavor, lot!.expirationDate],
            );
            steps.push(
                db
                    .prepare(
                        `UPDATE surplus_reports SET status='reconciled',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND ${pending}`,
                    )
                    .bind(user.id, c.reportId, c.operationId),
            );
            steps.push(
                db
                    .prepare(`UPDATE surplus_forecasts SET status='reconciled' WHERE report_id=? AND ${pending}`)
                    .bind(c.reportId, c.operationId),
            );
        }
    } else if (c.kind === 'deduct') {
        if (!c.reason?.trim() || !c.requestRef?.trim()) fail('A request/reference and reason are required.');
        if (c.reason === 'Destruction') {
            if (!c.confirmerName?.trim() || !c.date || !validDate(c.date) || c.date > today)
                fail('Verified destruction date and staff name are required.');
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date<? AND expired_units>=?)', [
                lot!.id,
                today,
                quantity,
            ]);
            update('expired_units=expired_units-?', [quantity]);
        } else {
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND on_hand-reserved>=?)', [
                lot!.id,
                c.reason === 'Donation'
                    ? new Date(Date.parse(today + 'T00:00:00Z') + 60 * 86400000).toISOString().slice(0, 10)
                    : today,
                quantity,
            ]);
            update('on_hand=on_hand-?', [quantity]);
        }
    } else if (c.kind === 'reserve') {
        if (
            !SEED_AGENCIES.some((a) => a.id === c.destinationAgencyId) ||
            !Number.isSafeInteger(c.destinationAgencyId) ||
            c.destinationAgencyId === lot!.agencyId ||
            !c.requestRef?.trim()
        )
            fail('A different destination agency and request reference are required.');
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND on_hand-reserved>=?)', [
            lot!.id,
            today,
            quantity,
        ]);
        update('reserved=reserved+?', [quantity]);
        transferId = crypto.randomUUID();
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_transfers(id,source_lot_id,source_agency_id,destination_agency_id,quantity,request_ref,formula_name,form,flavor,expiration_date,status) SELECT ?,?,?,?,?,?,?,?,?,?,'reserved' WHERE ${pending}`,
                )
                .bind(
                    transferId,
                    lot!.id,
                    lot!.agencyId,
                    c.destinationAgencyId,
                    quantity,
                    c.requestRef,
                    lot!.formulaName,
                    lot!.form,
                    lot!.flavor,
                    lot!.expirationDate,
                    c.operationId,
                ),
        );
    } else if (['ship', 'receive', 'cancel'].includes(c.kind)) {
        const t = await db
            .prepare('SELECT * FROM surplus_transfers WHERE id=? AND source_lot_id=?')
            .bind(c.transferId ?? '', lot!.id)
            .first<any>();
        if (!t) fail('Transfer not found.');
        quantity = t.quantity;
        guard('EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND source_lot_id=? AND status=?)', [
            t.id,
            lot!.id,
            c.kind === 'receive' ? 'shipped' : 'reserved',
        ]);
        if (c.kind === 'ship') {
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND reserved>=?)', [
                lot!.id,
                today,
                quantity,
            ]);
            update('on_hand=on_hand-?,reserved=reserved-?', [quantity, quantity]);
        }
        if (c.kind === 'cancel') update('reserved=reserved-?', [quantity]);
        if (c.kind === 'receive') {
            const dest = await ensureSurplusLot(db, t.destination_agency_id, {
                formulaName: t.formula_name,
                form: t.form,
                flavor: t.flavor,
                expirationDate: t.expiration_date,
            });
            movementLot = dest.id;
            update(
                dest.expirationDate < today ? 'expired_units=expired_units+?' : 'on_hand=on_hand+?',
                [quantity],
                dest.id,
            );
        }
        steps.push(
            db
                .prepare(
                    `UPDATE surplus_transfers SET status=?,shipped_date=CASE WHEN ?='ship' THEN ? ELSE shipped_date END,received_date=CASE WHEN ?='receive' THEN ? ELSE received_date END,tracking_reference=CASE WHEN ?='ship' THEN ? ELSE tracking_reference END WHERE id=? AND ${pending}`,
                )
                .bind(
                    c.kind === 'ship' ? 'shipped' : c.kind === 'receive' ? 'received' : 'cancelled',
                    c.kind,
                    today,
                    c.kind,
                    today,
                    c.kind,
                    c.trackingReference ?? '',
                    t.id,
                    c.operationId,
                ),
        );
    } else if (c.kind === 'expire') {
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date<? AND on_hand>0)', [lot!.id, today]);
        quantity = lot!.onHand;
        update('expired_units=expired_units+on_hand,on_hand=0,reserved=0');
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?||':'||t.id,?,l.id,'reservation-expired',t.quantity,?,t.request_ref,'Expiration released reservation',l.on_hand,l.reserved,l.expired_units FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id WHERE l.id=? AND t.status='reserved' AND ${pending}`,
                )
                .bind(c.operationId, c.operationId, user.id, lot!.id, c.operationId),
        );
        steps.push(
            db
                .prepare(
                    `UPDATE surplus_transfers SET status='blocked-expired' WHERE source_lot_id=? AND status='reserved' AND ${pending}`,
                )
                .bind(lot!.id, c.operationId),
        );
    } else if (c.kind === 'correct-expiry') {
        if (
            !c.expirationDate ||
            !validDate(c.expirationDate) ||
            c.expirationDate < today ||
            !c.reason?.trim() ||
            !Number.isInteger(c.expectedVersion)
        )
            fail('Verified expiration date, version and correction reason required.');
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND reserved=0)', [
            lot!.id,
            c.expectedVersion,
        ]);
        update('expiration_date=?,variant_key=?,on_hand=on_hand+expired_units,expired_units=0', [
            c.expirationDate,
            variantKey({ ...lot!, expirationDate: c.expirationDate! }),
        ]);
    } else fail('Unknown inventory action.');
    const result = { operationId: c.operationId, lotId: c.lotId, ...(transferId ? { transferId } : {}) };
    steps.push(
        db
            .prepare(
                `INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?,?,?,?,?,?,?,?,on_hand,reserved,expired_units FROM surplus_lots WHERE id=? AND ${pending}`,
            )
            .bind(
                crypto.randomUUID(),
                c.operationId,
                movementLot,
                c.kind,
                quantity,
                user.id,
                c.requestRef ?? '',
                JSON.stringify({ reason: c.reason ?? '', staff: c.confirmerName, date: c.date }),
                movementLot,
                c.operationId,
            ),
    );
    steps.push(
        db
            .prepare(`UPDATE surplus_commands SET status='done',result=? WHERE id=? AND status='pending'`)
            .bind(JSON.stringify(result), c.operationId),
    );
    steps.push(db.prepare('DELETE FROM surplus_guard'));
    try {
        await db.batch(steps);
    } catch {
        fail('Inventory changed or this action is not allowed. Refresh the inventory and try again.');
    }
    const saved = await db.prepare('SELECT * FROM surplus_commands WHERE id=?').bind(c.operationId).first<any>();
    if (saved.payload !== payload || saved.actor_id !== user.id) fail('Operation ID already used.');
    return JSON.parse(saved.result);
}
export async function expireSurplusLots(db: D1Database, today = localDate()) {
    const rows = await db
        .prepare(`SELECT ${columns} FROM surplus_lots WHERE expiration_date<? AND on_hand>0`)
        .bind(today)
        .all<SurplusLot>();
    for (const lot of rows.results) {
        await executeSurplusCommand(
            db,
            { id: 0, role: 'admin', memberType: 'internal' } as SessionUser,
            { kind: 'expire', operationId: `expire:${lot.id}:${lot.expirationDate}:${lot.version}`, lotId: lot.id },
            today,
        );
    }
}
export async function listSurplus(db: D1Database, user: SessionUser) {
    await expireSurplusLots(db);
    const scope = isReviewer(user) ? '1=1' : 'agency_id=?';
    const query = (table: string) => {
        const s = db.prepare(`SELECT * FROM ${table} WHERE ${scope}`);
        return isReviewer(user) ? s : s.bind(user.agencyId ?? -1);
    };
    return {
        movements: (
            await db
                .prepare(
                    `SELECT m.*,l.agency_id,l.formula_name,l.form,l.flavor FROM surplus_movements m JOIN surplus_lots l ON l.id=m.lot_id WHERE (?=1 OR l.agency_id=?) ORDER BY m.created_at DESC,m.rowid DESC LIMIT 500`,
                )
                .bind(isReviewer(user) ? 1 : 0, user.agencyId ?? -1)
                .all<SurplusMovement>()
        ).results,
        lots: (
            await (
                isReviewer(user)
                    ? db.prepare(`SELECT ${columns} FROM surplus_lots`)
                    : db.prepare(`SELECT ${columns} FROM surplus_lots WHERE agency_id=?`).bind(user.agencyId ?? -1)
            ).all<SurplusLot>()
        ).results,
        reports: (await query('surplus_reports').all<SurplusReport>()).results,
        forecasts: (await query('surplus_forecasts').all<SurplusForecast>()).results,
        transfers: (
            await (
                isReviewer(user)
                    ? db.prepare('SELECT * FROM surplus_transfers')
                    : db
                          .prepare(
                              'SELECT * FROM surplus_transfers WHERE source_agency_id=? OR destination_agency_id=?',
                          )
                          .bind(user.agencyId ?? -1, user.agencyId ?? -1)
            ).all<SurplusTransfer>()
        ).results,
    };
}
