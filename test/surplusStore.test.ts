import { describe, expect, it } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { executeSurplusCommand, ensureSurplusLot, expireSurplusLots } from '../server/utils/surplusStore';
import { getDemoUser } from '../server/utils/session';
const actor = getDemoUser('admin');
const agencyActor = getDemoUser('agency');
const variant = { formulaName: 'Fortini', form: 'ready-to-feed', flavor: '', expirationDate: '2027-01-01' };
describe('atomic surplus inventory', () => {
    it('limits agency commands to attested reconciliations of their own stock', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, variant);
        await executeSurplusCommand(db, actor, {kind:'reconcile',operationId:'initial-agency-stock',lotId:lot.id,quantity:10,expectedVersion:0,reason:'Initial count'},'2026-10-26');
        await executeSurplusCommand(db, actor, {kind:'reserve',operationId:'initial-reservation',lotId:lot.id,quantity:4,destinationAgencyId:11,requestRef:'req'},'2026-10-26');
        const count = {kind:'reconcile' as const,operationId:'agency-count',lotId:lot.id,quantity:3,expectedVersion:2,reason:'Agency count',date:'2026-10-26',confirmerName:'Staff'};
        await expect(executeSurplusCommand(db,agencyActor,count,'2026-10-26')).rejects.toThrow();
        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({on_hand:10,reserved:4});
        const accepted=await executeSurplusCommand(db,agencyActor,{...count,operationId:'agency-valid-count',quantity:6},'2026-10-26');
        expect(accepted.lotId).toBe(lot.id);
        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({on_hand:6,reserved:4});
        await expect(executeSurplusCommand(db,agencyActor,{...count,operationId:'agency-missing-date',quantity:6,expectedVersion:3,date:undefined},'2026-10-26')).rejects.toThrow();
        await expect(executeSurplusCommand(db,agencyActor,{...count,operationId:'agency-deduction',kind:'deduct',quantity:1,expectedVersion:2,requestRef:'req'},'2026-10-26')).rejects.toThrow();
        const otherAgencyLot = await ensureSurplusLot(db, 11, {...variant,formulaName:'Other formula'});
        await expect(executeSurplusCommand(db,agencyActor,{...count,operationId:'agency-foreign',lotId:otherAgencyLot.id,quantity:1},'2026-10-26')).rejects.toThrow();
        const expiredLot=await ensureSurplusLot(db,10,{...variant,formulaName:'Expires soon',expirationDate:'2026-10-25'});
        await executeSurplusCommand(db,actor,{kind:'reconcile',operationId:'pre-expiration-count',lotId:expiredLot.id,quantity:5,expectedVersion:0,reason:'Count'},'2026-10-20');
        await expect(executeSurplusCommand(db,agencyActor,{kind:'deduct',operationId:'unauthorized-expiry-trigger',lotId:expiredLot.id,quantity:1,reason:'Inventory correction',requestRef:'x'},'2026-10-26')).rejects.toThrow();
        expect(await db.prepare('SELECT on_hand,expired_units FROM surplus_lots WHERE id=?').bind(expiredLot.id).first()).toEqual({on_hand:5,expired_units:0});
    });
    it('allows agency donations only 30 through 60 days before expiry, inclusive', async () => {
        for (const [daysUntilExpiry, allowed] of [[29, false], [30, true], [60, true], [61, false]] as const) {
            const { db } = surplusDb();
            const expiry = new Date(Date.UTC(2026, 9, 26 + daysUntilExpiry)).toISOString().slice(0, 10);
            const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: `Donation ${daysUntilExpiry}`, expirationDate: expiry });
            await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: `donation-count-${daysUntilExpiry}`, lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Count' }, '2026-10-26');
            const donation = { kind: 'deduct' as const, operationId: `agency-donation-${daysUntilExpiry}`, lotId: lot.id, quantity: 3, reason: 'Donation', confirmerName: 'Agency Staff', date: '2026-10-26' };

            if (allowed) {
                await executeSurplusCommand(db, agencyActor, donation, '2026-10-26');
                expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(7);
            } else {
                await expect(executeSurplusCommand(db, agencyActor, donation, '2026-10-26')).rejects.toThrow();
                expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(10);
            }
        }
    });
    it('prevents agency adjustments to another agency lot and quantities beyond available units', async () => {
        const { db } = surplusDb();
        const ownLot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Own donation lot', expirationDate: '2026-11-25' });
        const foreignLot = await ensureSurplusLot(db, 11, { ...variant, formulaName: 'Foreign donation lot', expirationDate: '2026-11-25' });
        await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: 'own-donation-stock', lotId: ownLot.id, quantity: 3, expectedVersion: 0, reason: 'Count' }, '2026-10-26');
        await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: 'foreign-donation-stock', lotId: foreignLot.id, quantity: 3, expectedVersion: 0, reason: 'Count' }, '2026-10-26');
        const donation = { kind: 'deduct' as const, lotId: ownLot.id, quantity: 4, reason: 'Donation', confirmerName: 'Agency Staff', date: '2026-10-26' };

        await expect(executeSurplusCommand(db, agencyActor, { ...donation, operationId: 'agency-donation-over-balance' }, '2026-10-26')).rejects.toThrow();
        await expect(executeSurplusCommand(db, agencyActor, { ...donation, operationId: 'agency-donation-foreign-lot', lotId: foreignLot.id, quantity: 1 }, '2026-10-26')).rejects.toThrow();
        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(ownLot.id).first('on_hand')).toBe(3);
        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(foreignLot.id).first('on_hand')).toBe(3);
    });
    it('keeps non-adjustment agency commands and destruction of unexpired stock prohibited', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Unexpired stock', expirationDate: '2026-11-25' });
        await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: 'unexpired-agency-count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Count' }, '2026-10-26');

        await expect(executeSurplusCommand(db, agencyActor, { kind: 'reserve', operationId: 'agency-still-cannot-reserve', lotId: lot.id, quantity: 1, destinationAgencyId: 11, requestRef: 'request' }, '2026-10-26')).rejects.toThrow();
        await expect(executeSurplusCommand(db, agencyActor, { kind: 'deduct', operationId: 'agency-cannot-destroy-unexpired-stock', lotId: lot.id, quantity: 1, reason: 'Destruction', confirmerName: 'Agency Staff', date: '2026-10-26' }, '2026-10-26')).rejects.toThrow();
        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({ on_hand: 10, reserved: 0 });
    });
    it('allows an agency to destroy its expired stock with staff and date attestation', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Expired agency stock', expirationDate: '2026-10-25' });
        await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: 'expired-agency-count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Count' }, '2026-10-20');
        const destruction = { kind: 'deduct' as const, operationId: 'agency-destruction', lotId: lot.id, quantity: 4, reason: 'Destruction', confirmerName: 'Agency Staff', date: '2026-10-26' };

        await expect(executeSurplusCommand(db, agencyActor, { ...destruction, operationId: 'agency-destruction-no-attestation', confirmerName: '' }, '2026-10-26')).rejects.toThrow();
        await expect(executeSurplusCommand(db, agencyActor, { ...destruction, operationId: 'agency-destruction-no-date', date: undefined }, '2026-10-26')).rejects.toThrow();
        await expect(executeSurplusCommand(db, agencyActor, { ...destruction, operationId: 'agency-destruction-before-expiry', date: '2026-10-25' }, '2026-10-26')).rejects.toThrow();
        await executeSurplusCommand(db, agencyActor, destruction, '2026-10-26');

        expect(await db.prepare('SELECT expired_units FROM surplus_lots WHERE id=?').bind(lot.id).first('expired_units')).toBe(6);
        expect(await db.prepare('SELECT kind,quantity,actor_id,reason FROM surplus_movements WHERE operation_id=?').bind(destruction.operationId).first()).toEqual({
            kind: 'deduct', quantity: 4, actor_id: agencyActor.id,
            reason: JSON.stringify({ reason: 'Destruction', staff: 'Agency Staff', date: '2026-10-26' }),
        });
    });
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

describe('agency surplus entry corrections', () => {
    async function version(db: D1Database, lotId: string) {
        return Number(await db.prepare('SELECT version FROM surplus_lots WHERE id=?').bind(lotId).first('version'));
    }
    async function movementId(db: D1Database, operationId: string) {
        return String(await db.prepare('SELECT id FROM surplus_movements WHERE operation_id=?').bind(operationId).first('id'));
    }
    async function correct(db: D1Database, lotId: string, correctionOf: string, quantity: number, operationId: string, expectedVersion: number, user = agencyActor) {
        return executeSurplusCommand(db, user, {
            kind: 'correct-entry' as any,
            operationId,
            lotId,
            correctionOf,
            quantity,
            expectedVersion,
            reason: 'Correcting the recorded unit count',
            confirmerName: 'Correcting Agency Staff',
            date: '2026-10-26',
        } as any, '2026-10-26');
    }

    it('corrects and re-corrects an own-agency physical count by only the difference', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Count correction', expirationDate: '2027-01-01' });
        await executeSurplusCommand(db, agencyActor, { kind: 'reconcile', operationId: 'count-to-correct', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Opening count',confirmerName:'Agency Staff',date:'2026-10-26' }, '2026-10-26');
        const originalId = await movementId(db, 'count-to-correct');

        await correct(db, lot.id, originalId, 8, 'count-correction-one', await version(db, lot.id));
        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(8);
        await correct(db, lot.id, originalId, 6, 'count-correction-two', await version(db, lot.id));

        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(6);
        expect(await db.prepare('SELECT kind,quantity,corrects_movement_id,corrected_quantity FROM surplus_movements WHERE id=?').bind(originalId).first()).toEqual({ kind: 'reconcile', quantity: 10, corrects_movement_id: null, corrected_quantity: null });
        expect(await db.prepare('SELECT COUNT(*) AS count FROM surplus_movements WHERE corrects_movement_id=?').bind(originalId).first('count')).toBe(2);
        expect(await db.prepare('SELECT corrected_quantity FROM surplus_movements WHERE corrects_movement_id=? ORDER BY rowid DESC LIMIT 1').bind(originalId).first('corrected_quantity')).toBe(6);
    });

    it('corrects a donation quantity against the current unexpired balance', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Donation correction', expirationDate: '2026-11-25' });
        await executeSurplusCommand(db, agencyActor, { kind: 'reconcile', operationId: 'donation-correction-count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Opening count',confirmerName:'Agency Staff',date:'2026-10-26' }, '2026-10-26');
        await executeSurplusCommand(db, agencyActor, { kind: 'deduct', operationId: 'donation-to-correct', lotId: lot.id, quantity: 3, reason: 'Donation',confirmerName:'Agency Staff',date:'2026-10-26' }, '2026-10-26');
        const originalId = await movementId(db, 'donation-to-correct');

        await executeSurplusCommand(db, agencyActor, {
            kind: 'correct-entry' as any, operationId: 'donation-correction', lotId: lot.id, correctionOf: originalId,
            quantity: 2, expectedVersion: await version(db, lot.id), reason: 'Destruction',
            confirmerName: 'Correcting Agency Staff', date: '2026-10-26',
        } as any, '2026-10-26');

        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(8);
        expect(await db.prepare('SELECT kind,quantity,corrects_movement_id FROM surplus_movements WHERE id=?').bind(originalId).first()).toEqual({ kind: 'deduct', quantity: 3, corrects_movement_id: null });
    });

    it('corrects a destruction quantity against expired stock', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Destruction correction', expirationDate: '2026-10-25' });
        await executeSurplusCommand(db, agencyActor, { kind: 'reconcile', operationId: 'destruction-correction-count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Opening count',confirmerName:'Agency Staff',date:'2026-10-20' }, '2026-10-20');
        await executeSurplusCommand(db, agencyActor, { kind: 'deduct', operationId: 'destruction-to-correct', lotId: lot.id, quantity: 4, reason: 'Destruction', confirmerName: 'Agency Staff', date: '2026-10-26' }, '2026-10-26');
        const originalId = await movementId(db, 'destruction-to-correct');

        await expect(correct(db, lot.id, originalId, 11, 'destruction-correction-beyond-balance', await version(db, lot.id))).rejects.toThrow();
        await correct(db, lot.id, originalId, 2, 'destruction-correction', await version(db, lot.id));

        expect(await db.prepare('SELECT on_hand,expired_units FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({ on_hand: 0, expired_units: 8 });
    });

    it('rejects stale, foreign, unsupported, and balance-conflicting corrections', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'Protected correction', expirationDate: '2027-01-01' });
        await executeSurplusCommand(db, agencyActor, { kind: 'reconcile', operationId: 'protected-correction-count', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Opening count',confirmerName:'Agency Staff',date:'2026-10-26' }, '2026-10-26');
        const originalId = await movementId(db, 'protected-correction-count');
        await executeSurplusCommand(db, actor, { kind: 'reserve', operationId: 'protected-correction-reserve', lotId: lot.id, quantity: 4, destinationAgencyId: 11, requestRef: 'request' }, '2026-10-26');

        await expect(correct(db, lot.id, originalId, 3, 'correction-below-reserved', await version(db, lot.id))).rejects.toThrow();
        await expect(correct(db, lot.id, originalId, 8, 'correction-stale', 1)).rejects.toThrow();
        await expect(correct(db, lot.id, originalId, 8, 'correction-reviewer', await version(db, lot.id), actor)).rejects.toThrow();
        const foreignLot = await ensureSurplusLot(db, 11, { ...variant, formulaName: 'Foreign correction lot' });
        await executeSurplusCommand(db, actor, { kind: 'reconcile', operationId: 'foreign-correction-count', lotId: foreignLot.id, quantity: 10, expectedVersion: 0, reason: 'Opening count' }, '2026-10-26');
        const foreignId = await movementId(db, 'foreign-correction-count');
        await expect(correct(db, foreignLot.id, foreignId, 8, 'correction-foreign-agency', await version(db, foreignLot.id))).rejects.toThrow();
        await expect(correct(db, lot.id, 'missing-movement', 8, 'correction-unsupported', await version(db, lot.id))).rejects.toThrow();

        const reportLot=await ensureSurplusLot(db,10,{...variant,formulaName:'Reviewer reconciled entry'});
        await db.prepare("INSERT INTO surplus_reports(id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,status,request_ref,reporter_id,counted_at,confirmer_name,reason) VALUES('report-correction-test','row',10,? ,?,'',?,5,'pending','','10','2026-10-26','Reporter','Count')").bind(reportLot.formulaName,reportLot.form,reportLot.expirationDate).run();
        await executeSurplusCommand(db,actor,{kind:'reconcile',operationId:'reviewer-reconciled-entry',lotId:reportLot.id,quantity:5,expectedVersion:0,reason:'Reviewed count',reportId:'report-correction-test'},'2026-10-26');
        const reviewerCountId=await movementId(db,'reviewer-reconciled-entry');
        await expect(correct(db,reportLot.id,reviewerCountId,4,'agency-corrects-reviewer-entry',await version(db,reportLot.id))).rejects.toThrow();

        const directCountLot=await ensureSurplusLot(db,10,{...variant,formulaName:'Legacy direct count'});
        await executeSurplusCommand(db,actor,{kind:'reconcile',operationId:'reviewer-direct-count',lotId:directCountLot.id,quantity:5,expectedVersion:0,reason:'Direct physical count'},'2026-10-26');
        const directCountId=await movementId(db,'reviewer-direct-count');
        await correct(db,directCountLot.id,directCountId,4,'agency-corrects-direct-count',await version(db,directCountLot.id));
        expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(directCountLot.id).first('on_hand')).toBe(4);

        const reserveLot=await ensureSurplusLot(db,10,{...variant,formulaName:'Reserved movement entry'});
        await executeSurplusCommand(db,actor,{kind:'reconcile',operationId:'reserve-entry-count',lotId:reserveLot.id,quantity:8,expectedVersion:0,reason:'Count'},'2026-10-26');
        await executeSurplusCommand(db,actor,{kind:'reserve',operationId:'reserve-entry-reserve',lotId:reserveLot.id,quantity:1,destinationAgencyId:11,requestRef:'request'},'2026-10-26');
        const reserveMovementId=await movementId(db,'reserve-entry-reserve');
        await expect(correct(db,reserveLot.id,reserveMovementId,0,'agency-corrects-reservation',await version(db,reserveLot.id))).rejects.toThrow();

        expect(await db.prepare('SELECT on_hand,reserved FROM surplus_lots WHERE id=?').bind(lot.id).first()).toEqual({ on_hand: 10, reserved: 4 });
    });
});
