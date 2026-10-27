import { describe, expect, it } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { executeSurplusCommand, ensureSurplusLot, expireSurplusLots } from '../server/utils/surplusStore';
import { getDemoUser } from '../server/utils/session';
const actor = getDemoUser('admin');
const variant = { formulaName: 'Fortini', form: 'ready-to-feed', flavor: '', expirationDate: '2027-01-01' };
describe('atomic surplus inventory', () => {
    it('reserves, ships and receives once without double allocation', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, variant);
        await executeSurplusCommand(
            db,
            actor,
            {
                kind: 'reconcile',
                operationId: 'count',
                lotId: lot.id,
                quantity: 10,
                expectedVersion: 0,
                reason: 'Opening count',
            },
            '2026-10-26',
        );
        const reserve = {
            kind: 'reserve' as const,
            operationId: 'reserve',
            lotId: lot.id,
            quantity: 4,
            destinationAgencyId: 11,
            requestRef: 'req-1',
        };
        const r = await executeSurplusCommand(db, actor, reserve, '2026-10-26');
        await executeSurplusCommand(db, actor, reserve, '2026-10-26');
        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({
            on_hand: 10,
            reserved: 4,
        });
        await expect(
            executeSurplusCommand(db, actor, { ...reserve, operationId: 'over', quantity: 7 }, '2026-10-26'),
        ).rejects.toThrow();
        await executeSurplusCommand(
            db,
            actor,
            { kind: 'ship', operationId: 'ship', lotId: lot.id, transferId: r.transferId },
            '2026-10-26',
        );
        await executeSurplusCommand(
            db,
            actor,
            { kind: 'receive', operationId: 'receive', lotId: lot.id, transferId: r.transferId },
            '2026-10-26',
        );
        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({
            on_hand: 6,
            reserved: 0,
        });
        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE agency_id=11').first('on_hand')).toBe(4);
    });
    it('quarantines all expired stock and blocks transfers, then destroys once', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, expirationDate: '2026-10-26' });
        await executeSurplusCommand(
            db,
            actor,
            {
                kind: 'reconcile',
                operationId: 'count',
                lotId: lot.id,
                quantity: 10,
                expectedVersion: 0,
                reason: 'Count',
            },
            '2026-10-26',
        );
        const r = await executeSurplusCommand(
            db,
            actor,
            {
                kind: 'reserve',
                operationId: 'res',
                lotId: lot.id,
                quantity: 3,
                destinationAgencyId: 11,
                requestRef: 'r',
            },
            '2026-10-26',
        );
        await expireSurplusLots(db, '2026-10-27');
        await expireSurplusLots(db, '2026-10-27');
        expect(
            await db.prepare('SELECT on_hand,reserved,expired_units FROM surplus_lots WHERE id=?').bind(lot.id).first(),
        ).toEqual({ on_hand: 0, reserved: 0, expired_units: 10 });
        await expect(
            executeSurplusCommand(
                db,
                actor,
                { kind: 'ship', operationId: 'ship', lotId: lot.id, transferId: r.transferId },
                '2026-10-27',
            ),
        ).rejects.toThrow();
        const destroy = {
            kind: 'deduct' as const,
            operationId: 'destroy',
            lotId: lot.id,
            quantity: 4,
            requestRef: 'r',
            reason: 'Destruction',
            confirmerName: 'Agency Staff',
            date: '2026-10-27',
        };
        await executeSurplusCommand(db, actor, destroy, '2026-10-27');
        await executeSurplusCommand(db, actor, destroy, '2026-10-27');
        expect(
            await db.prepare('SELECT expired_units FROM surplus_lots WHERE id=?').bind(lot.id).first('expired_units'),
        ).toBe(6);
    });
});
it('keeps shipped expiration immutable after a source correction', async () => {
    const { db } = surplusDb();
    const lot = await ensureSurplusLot(db, 10, { ...variant, expirationDate: '2026-10-26' });
    await executeSurplusCommand(
        db,
        actor,
        { kind: 'reconcile', operationId: 'count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Count' },
        '2026-10-26',
    );
    const r = await executeSurplusCommand(
        db,
        actor,
        { kind: 'reserve', operationId: 'res', lotId: lot.id, quantity: 3, destinationAgencyId: 11, requestRef: 'r' },
        '2026-10-26',
    );
    await executeSurplusCommand(
        db,
        actor,
        { kind: 'ship', operationId: 'ship', lotId: lot.id, transferId: r.transferId },
        '2026-10-26',
    );
    await executeSurplusCommand(
        db,
        actor,
        {
            kind: 'correct-expiry',
            operationId: 'fix',
            lotId: lot.id,
            expirationDate: '2027-01-01',
            expectedVersion: 3,
            reason: 'Verified remaining lot label',
        },
        '2026-10-26',
    );
    await executeSurplusCommand(
        db,
        actor,
        { kind: 'receive', operationId: 'receive', lotId: lot.id, transferId: r.transferId },
        '2026-10-27',
    );
    expect(
        await db.prepare('SELECT on_hand,expired_units,expiration_date FROM surplus_lots WHERE agency_id=11').first(),
    ).toEqual({ on_hand: 0, expired_units: 3, expiration_date: '2026-10-26' });
});
