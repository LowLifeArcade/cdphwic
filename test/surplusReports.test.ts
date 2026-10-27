import { describe, it, expect } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { persistSurplusSubmission, createForecast, confirmForecast } from '../server/utils/surplusReports';
import { ensureSurplusLot, executeSurplusCommand, listSurplus } from '../server/utils/surplusStore';
import { listSurplusNotices, refreshSurplusNotices } from '../server/utils/surplusNotices';
import { getDemoUser } from '../server/utils/session';
import { localDate } from '../shared/surplus';
import type { RequestRecord } from '../shared/domain';
const admin = getDemoUser('admin');
const agency = getDemoUser('agency');
const variant = { formulaName: 'Fortini', form: 'ready-to-feed', flavor: '', expirationDate: '2027-12-01' };
describe('surplus reporting and notices', () => {
    it('persists undated pending reports once and rejects changed retries', async () => {
        const { db } = surplusDb();
        const request = {
            id: 987,
            agencyId: 10,
            surplusItems: [{ productName: 'Fortini', productForm: 'ready-to-feed', units: 4 }],
        } as RequestRecord;
        await persistSurplusSubmission(db, 'submission-123', request, admin, 'same');
        await persistSurplusSubmission(db, 'submission-123', request, admin, 'same');
        expect(await db.prepare('SELECT COUNT(*) AS n FROM surplus_reports').first('n')).toBe(1);
        expect(await db.prepare('SELECT COUNT(*) AS n FROM surplus_lots').first('n')).toBe(0);
        await expect(persistSurplusSubmission(db, 'submission-123', request, admin, 'changed')).rejects.toThrow();
    });
    it('requires agency actual count and variance reason, then reviewer reconciliation', async () => {
        const { db } = surplusDb();
        const f = await createForecast(db, admin, {
            agencyId: agency.agencyId,
            requestRef: 'r',
            ...variant,
            expectedUnits: 8,
            dueDate: localDate(),
        });
        await expect(
            confirmForecast(db, agency, {
                forecastId: f.id,
                quantity: 5,
                date: localDate(),
                expirationDate: variant.expirationDate,
                confirmerName: 'Staff',
            }),
        ).rejects.toThrow();
        const report = await confirmForecast(db, agency, {
            forecastId: f.id,
            quantity: 5,
            date: localDate(),
            expirationDate: variant.expirationDate,
            confirmerName: 'Staff',
            reason: 'Three units were used',
        });
        expect((await listSurplus(db, agency)).lots).toHaveLength(0);
        const lot = await ensureSurplusLot(db, agency.agencyId!, variant);
        await executeSurplusCommand(db, admin, {
            kind: 'reconcile',
            operationId: 'review',
            lotId: lot.id,
            quantity: 5,
            reportId: report.id,
            expectedVersion: 0,
            reason: 'Verified count',
        });
        expect(await db.prepare('SELECT status FROM surplus_forecasts WHERE id=?').bind(f.id).first('status')).toBe(
            'reconciled',
        );
        expect((await listSurplus(db, agency)).lots[0]).toMatchObject({ onHand: 5 });
        await expect(
            executeSurplusCommand(db, agency, { kind: 'deduct', operationId: 'no', lotId: lot.id, quantity: 1 }),
        ).rejects.toThrow();
    });
    it('deduplicates donation/destruction notices at the calendar boundary, including reservations', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, agency.agencyId!, { ...variant, expirationDate: '2026-12-25' });
        await executeSurplusCommand(
            db,
            admin,
            {
                kind: 'reconcile',
                operationId: 'count',
                lotId: lot.id,
                quantity: 8,
                expectedVersion: 0,
                reason: 'Count',
            },
            '2026-10-26',
        );
        await executeSurplusCommand(
            db,
            admin,
            {
                kind: 'reserve',
                operationId: 'reserve',
                lotId: lot.id,
                quantity: 8,
                destinationAgencyId: 11,
                requestRef: 'r',
            },
            '2026-10-26',
        );
        await refreshSurplusNotices(db, '2026-10-26');
        await refreshSurplusNotices(db, '2026-10-26');
        expect(await db.prepare("SELECT COUNT(*) FROM surplus_notices WHERE kind='donation'").first('COUNT(*)')).toBe(
            1,
        );
        await refreshSurplusNotices(db, '2026-12-26');
        expect(
            await db.prepare("SELECT COUNT(*) FROM surplus_notices WHERE kind='destruction'").first('COUNT(*)'),
        ).toBe(1);
        expect(
            await db.prepare('SELECT on_hand,expired_units FROM surplus_lots WHERE id=?').bind(lot.id).first(),
        ).toEqual({ on_hand: 0, expired_units: 8 });
    });
    it('rejects stale counts and donations with fewer than 60 days', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { ...variant, expirationDate: '2026-12-24' });
        await executeSurplusCommand(
            db,
            admin,
            { kind: 'reconcile', operationId: 'c', lotId: lot.id, quantity: 10, expectedVersion: 0, reason: 'Count' },
            '2026-10-26',
        );
        await expect(
            executeSurplusCommand(
                db,
                admin,
                {
                    kind: 'reconcile',
                    operationId: 'stale',
                    lotId: lot.id,
                    quantity: 10,
                    expectedVersion: 0,
                    reason: 'Old count',
                },
                '2026-10-26',
            ),
        ).rejects.toThrow();
        await expect(
            executeSurplusCommand(
                db,
                admin,
                { kind: 'deduct', operationId: 'd', lotId: lot.id, quantity: 1, requestRef: 'r', reason: 'Donation' },
                '2026-10-26',
            ),
        ).rejects.toThrow();
    });
});
it('reconciles a case/whitespace variant into the same existing lot', async () => {
    const { db } = surplusDb();
    const lot = await ensureSurplusLot(db, 10, { ...variant, formulaName: 'fortini', flavor: '  Vanilla   Bean ' });
    const request = {
        id: 1234,
        agencyId: 10,
        surplusItems: [
            {
                productName: 'Fortini',
                productForm: 'ready-to-feed',
                flavor: 'Vanilla Bean',
                units: 4,
                expirationDate: variant.expirationDate,
            },
        ],
    } as RequestRecord;
    await persistSurplusSubmission(db, 'normalized-report', request, admin);
    await executeSurplusCommand(db, admin, {
        kind: 'reconcile',
        operationId: 'normalized-count',
        lotId: lot.id,
        quantity: 4,
        reportId: 'normalized-report:0',
        expectedVersion: 0,
        reason: 'Verified physical count',
    });
    expect(await db.prepare('SELECT on_hand FROM surplus_lots WHERE id=?').bind(lot.id).first('on_hand')).toBe(4);
});
