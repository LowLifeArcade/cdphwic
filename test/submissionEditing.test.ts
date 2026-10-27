import { describe, it, expect } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { getDemoUser } from '../server/utils/session';
import { persistSurplusSubmission } from '../server/utils/surplusReports';
import * as store from '../server/utils/submittedRequests';
import type { RequestRecord } from '../shared/domain';
const agency = getDemoUser('agency');
const request: RequestRecord = {
    id: 1000099,
    submissionId: 'editable-submission',
    agencyId: 10,
    agencyMemberId: 100,
    status: 'unopened',
    participantName: 'Synthetic Example',
    participantFirstName: 'Synthetic',
    participantLastName: 'Example',
    participantDob: '2020-01-01',
    participantFamilyId: 123,
    wicIndividualId: '456',
    benefitsStartDate: '2026-10-27',
    requestKind: 'new',
    medicalStatus: 'no',
    productName: 'Fortini',
    productForm: 'ready-to-feed',
    ouncesPrescribed: 24,
    durationMonths: 3,
    diagnosis: 'Prematurity',
    wicFoodRestrictions: 'none',
    doctorPrintedName: 'Synthetic Provider',
    doctorHasSignedOff: true,
    doctorOfficeName: 'Clinic',
    doctorOfficeAddress: '123 Test Street',
    doctorOfficePhone: '9165550123',
    prescriptionSignedDate: '2026-10-26',
};
async function fixture() {
    const { db } = surplusDb();
    await persistSurplusSubmission(db, request.submissionId!, request, agency);
    return db;
}
describe('submission edits before staff review', () => {
    it('allows complete edits before review and increments the version', async () => {
        const db = await fixture();
        const edited = await store.editSubmittedRequest(db, agency, request, { ouncesPrescribed: 30 }, 0);
        expect(edited.ouncesPrescribed).toBe(30);
        expect(edited.revision).toBe(1);
        expect(edited.status).toBe('unopened');
    });
    it('rejects an edit if staff opened it after the editor loaded it', async () => {
        const db = await fixture();
        await store.updateSubmittedRequest(db, request, { status: 'opened' });
        await expect(store.editSubmittedRequest(db, agency, request, { ouncesPrescribed: 30 }, 0)).rejects.toThrow();
        expect((await store.submittedRequest(db, request.id, agency))?.status).toBe('opened');
    });
    it('does not unlock a submission if its status is later reset', async () => {
        const db = await fixture();
        const opened = await store.updateSubmittedRequest(db, request, { status: 'opened' });
        const reset = await store.updateSubmittedRequest(db, opened, { status: 'unopened' });
        expect(reset.openedAt).toBeTruthy();
        await expect(
            store.editSubmittedRequest(db, agency, reset, { ouncesPrescribed: 30 }, reset.revision!),
        ).rejects.toThrow();
    });
    it('rejects stale edits and requests belonging to another agency', async () => {
        const db = await fixture();
        await store.editSubmittedRequest(db, agency, request, { ouncesPrescribed: 30 }, 0);
        await expect(store.editSubmittedRequest(db, agency, request, { ouncesPrescribed: 40 }, 0)).rejects.toThrow();
        await expect(
            store.editSubmittedRequest(db, { ...agency, agencyId: 11 }, request, { ouncesPrescribed: 40 }, 0),
        ).rejects.toThrow();
    });
    it('replaces pending surplus reports without adding inventory', async () => {
        const db = await fixture();
        await store.editSubmittedRequest(
            db,
            agency,
            request,
            {
                surplusItems: [
                    { productName: 'Fortini', productForm: 'ready-to-feed', units: 3, expirationDate: '2027-01-01' },
                ],
            },
            0,
        );
        expect(
            await db
                .prepare("SELECT reported_units FROM surplus_reports WHERE status='pending'")
                .first('reported_units'),
        ).toBe(3);
        expect(await db.prepare('SELECT COUNT(*) AS n FROM surplus_lots').first('n')).toBe(0);
    });
});
it('does not overwrite an editor save with an older review snapshot', async () => {
    const db = await fixture();
    const edited = await store.editSubmittedRequest(db, agency, request, { ouncesPrescribed: 30 }, 0);
    await expect(store.updateSubmittedRequest(db, request, { status: 'opened' })).rejects.toThrow();
    const opened = await store.updateSubmittedRequest(db, edited, { status: 'opened' });
    expect(opened.ouncesPrescribed).toBe(30);
    expect(opened.openedAt).toBeTruthy();
});
it('does not change inventory or overwrite a report that was already reviewed', async () => {
    const db = await fixture();
    const edited = await store.editSubmittedRequest(
        db,
        agency,
        request,
        {
            surplusItems: [
                { productName: 'Fortini', productForm: 'ready-to-feed', units: 3, expirationDate: '2027-01-01' },
            ],
        },
        0,
    );
    await db.prepare("UPDATE surplus_reports SET status='reconciled'").run();
    await expect(
        store.editSubmittedRequest(db, agency, edited, { surplusItems: [] }, edited.revision!),
    ).rejects.toThrow();
    expect((await store.submittedRequest(db, request.id, agency))?.surplusItems?.[0]?.units).toBe(3);
});
