import { describe, expect, it } from 'vitest';
import { ensureSurplusLot } from '../server/utils/surplusStore';
import { listSurplusDispositions } from '../server/utils/surplusDisposalReport';
import { surplusDb } from './helpers/surplusDb';
import type { SessionUser } from '../shared/domain';

const agencyUser: SessionUser = { id: 2, name: 'Agency Rep', role: 'member', memberType: 'agency', agencyId: 10, agencyMemberId: 100 };
const adminUser: SessionUser = { id: 1, name: 'Admin', role: 'admin', memberType: 'internal' };
const internalUser: SessionUser = { id: 3, name: 'CDPH/WIC', role: 'member', memberType: 'internal', internalMemberId: 200 };

async function addDisposal(
    db: D1Database,
    lotId: string,
    id: string,
    reason: 'Donation' | 'Destruction',
    date: string | undefined,
    quantity: number,
    actorId = 2,
    createdAt = '2026-11-24 10:00:00',
) {
    const operationId = `op-${id}`;
    await db.prepare('INSERT INTO surplus_commands(id,actor_id,payload,status) VALUES(?,?,?,?)')
        .bind(operationId, actorId, JSON.stringify({ kind: 'deduct', reason }), 'completed').run();
    await db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units,created_at)
        VALUES(?,?,?,'deduct',?,?,?,0,0,0,?)`)
        .bind(id, operationId, lotId, quantity, actorId, JSON.stringify({ reason, staff: 'Attesting Staff', ...(date ? { date } : {}) }), createdAt).run();
}

describe('surplus disposal report', () => {
    it('returns agency donations and destruction within inclusive entered event dates', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { formulaName: 'Formula A', form: 'powder', flavor: 'Vanilla', packaging: '12.4 oz', expirationDate: '2026-12-31' });
        await addDisposal(db, lot.id, 'donation-start', 'Donation', '2026-10-01', 3, 2, '2026-11-20 10:00:00');
        await addDisposal(db, lot.id, 'destruction-end', 'Destruction', '2026-10-31', 2, 2, '2026-11-21 10:00:00');
        await addDisposal(db, lot.id, 'donation-outside', 'Donation', '2026-09-30', 1, 2, '2026-10-01 10:00:00');

        const rows = await listSurplusDispositions(db, agencyUser, '2026-10-01', '2026-10-31');

        expect(rows).toHaveLength(2);
        expect(rows.map((row) => [row.kind, row.event_date, row.quantity])).toEqual([
            ['Destruction', '2026-10-31', 2],
            ['Donation', '2026-10-01', 3],
        ]);
        expect(rows[1]).toMatchObject({ formula_name: 'Formula A', form: 'powder', flavor: 'Vanilla', packaging: '12.4 oz', staff_name: 'Attesting Staff', recorded_by: 'Maria Lopez', recorded_at: '2026-11-20 10:00:00' });
        expect(rows[1].recorded_at).not.toContain(rows[1].event_date);
    });

    it('keeps agency users scoped to their own agency while reviewers see all agencies', async () => {
        const { db } = surplusDb();
        const ownLot = await ensureSurplusLot(db, 10, { formulaName: 'Own Formula', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        const otherLot = await ensureSurplusLot(db, 11, { formulaName: 'Other Formula', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, ownLot.id, 'own', 'Donation', '2026-10-01', 2);
        await addDisposal(db, otherLot.id, 'other', 'Destruction', '2026-10-01', 4, 3);

        expect((await listSurplusDispositions(db, agencyUser)).map((row) => row.formula_name)).toEqual(['Own Formula']);
        expect((await listSurplusDispositions(db, adminUser)).map((row) => row.agency_id).sort()).toEqual([10, 11]);
        expect((await listSurplusDispositions(db, internalUser)).map((row) => row.agency_id).sort()).toEqual([10, 11]);
    });

    it('allows either date bound to be omitted', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { formulaName: 'Formula B', form: 'concentrate', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, lot.id, 'early', 'Donation', '2026-01-01', 1);
        await addDisposal(db, lot.id, 'late', 'Destruction', '2026-12-31', 1);

        expect((await listSurplusDispositions(db, agencyUser, undefined, '2026-01-01')).map((row) => row.event_date)).toEqual(['2026-01-01']);
        expect((await listSurplusDispositions(db, agencyUser, '2026-12-31', undefined)).map((row) => row.event_date)).toEqual(['2026-12-31']);
        expect(await listSurplusDispositions(db, agencyUser)).toHaveLength(2);
    });

    it('includes undated reviewer donations only when no date filter is selected', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { formulaName: 'Undated Formula', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, lot.id, 'undated-review-donation', 'Donation', undefined, 2, 3);

        const allRows = await listSurplusDispositions(db, agencyUser);
        const boundedRows = await listSurplusDispositions(db, agencyUser, '2026-01-01');

        expect(allRows).toHaveLength(1);
        expect(allRows[0]).toMatchObject({ id: 'undated-review-donation', event_date: '', kind: 'Donation' });
        expect(boundedRows).toHaveLength(0);
    });

    it('rejects invalid and reversed date ranges', async () => {
        const { db } = surplusDb();
        await expect(listSurplusDispositions(db, agencyUser, '2026-02-30')).rejects.toMatchObject({ statusCode: 400 });
        await expect(listSurplusDispositions(db, agencyUser, '2026-10-02', '2026-10-01')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('excludes non-disposal movements and reports corrected disposal quantity once', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { formulaName: 'Formula C', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, lot.id, 'donation-corrected', 'Donation', '2026-10-15', 4);
        await db.prepare('INSERT INTO surplus_commands(id,actor_id,payload,status) VALUES(?,?,?,?)')
            .bind('op-correction', 2, JSON.stringify({ kind: 'correct-entry' }), 'completed').run();
        await db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units,corrects_movement_id,corrected_quantity)
            VALUES('correction','op-correction',?,'correct-entry',1,2,?,0,0,0,'donation-corrected',2)`)
            .bind(lot.id, JSON.stringify({ reason: 'Correction', note: 'Quantity corrected', staff: 'Correcting Staff', date: '2026-10-20' })).run();
        await db.prepare('INSERT INTO surplus_commands(id,actor_id,payload,status) VALUES(?,?,?,?)')
            .bind('op-count', 2, JSON.stringify({ kind: 'reconcile' }), 'completed').run();
        await db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units)
            VALUES('count','op-count',?,'reconcile',10,2,'{}',10,0,0)`).bind(lot.id).run();

        const rows = await listSurplusDispositions(db, agencyUser);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ id: 'donation-corrected', quantity: 2, original_quantity: 4, corrected: true });
    });
});
