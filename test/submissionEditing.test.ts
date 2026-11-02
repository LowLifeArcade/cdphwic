import { describe, it, expect } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { getDemoUser } from '../server/utils/session';
import { persistSurplusSubmission } from '../server/utils/surplusReports';
import * as store from '../server/utils/submittedRequests';
import type { RequestRecord } from '../shared/domain';
const agency = getDemoUser('agency');
const request: RequestRecord = {
    shipping:{clinicName:'Test Clinic',addressLine1:'123 Test St',addressLine2:'',city:'Ukiah',state:'CA',postalCode:'95482',attention:'Maria'},
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
it('saves incomplete Pending LA corrections and then resubmits the same request with replacement documentation',async()=>{
 const db=await fixture();const saved=await store.submittedRequest(db,request.id,agency);
 const sent=await store.requestMoreInfo(db,saved!,getDemoUser('internal'),'Correct signed date',saved!.revision??0);
 const pending=await store.reopenMoreInfoSubmission(db,sent,getDemoUser('internal'),sent.revision!);
 const incomplete=await store.editSubmittedRequest(db,agency,pending,{prescriptionSignedDate:''},pending.revision!,{saveOnly:true});
 expect(incomplete.status).toBe('needs_info');expect(incomplete.prescriptionSignedDate).toBe('');
 await expect(store.editSubmittedRequest(db,agency,incomplete,{},incomplete.revision!)).rejects.toMatchObject({statusCode:400});
 const resubmitted=await store.editSubmittedRequest(db,agency,incomplete,{prescriptionSignedDate:'2026-10-28'},incomplete.revision!,{attachment:{storageKey:'replacement',fileName:'updated.pdf',contentType:'application/pdf',size:100}});
 expect(resubmitted.id).toBe(request.id);expect(resubmitted.status).toBe('unopened');expect(resubmitted.openedAt).toBeUndefined();expect(resubmitted.moreInfoRequests?.at(-1)?.resubmittedAt).toBeTruthy();expect(resubmitted.prescriptionAttachment?.storageKey).toBe('replacement');
 expect(resubmitted.moreInfoRequests?.at(-1)?.resubmissionOpen).toBe(false);
 const reopened=await store.reopenMoreInfoSubmission(db,resubmitted,getDemoUser('internal'),resubmitted.revision!);expect(reopened.status).toBe('needs_info');
 const second=await store.editSubmittedRequest(db,agency,reopened,{},reopened.revision!,{saveOnly:true});expect(second.status).toBe('needs_info');
});
it('does not rewrite reconciled surplus when resubmitting unrelated corrections',async()=>{
 const {db}=surplusDb();const original={...request,submissionId:'reconciled-followup',id:1000100,surplusItems:[{productName:'Fortini',productForm:'ready-to-feed' as const,units:3,expirationDate:'2027-12-31'}]};
 await persistSurplusSubmission(db,original.submissionId,original,agency);
 await db.prepare("UPDATE surplus_reports SET status='reconciled' WHERE submission_id=?").bind(original.submissionId).run();
 const sent=await store.requestMoreInfo(db,original,getDemoUser('internal'),'Correct provider name',0);
 const pending=await store.reopenMoreInfoSubmission(db,sent,getDemoUser('internal'),sent.revision!);
 const saved=await store.editSubmittedRequest(db,agency,pending,{doctorPrintedName:'Updated Provider'},pending.revision!,{saveOnly:true});
 const resubmitted=await store.editSubmittedRequest(db,agency,saved,{},saved.revision!);
 expect(resubmitted.status).toBe('unopened');expect(await db.prepare('SELECT status FROM surplus_reports WHERE submission_id=?').bind(original.submissionId).first('status')).toBe('reconciled');
});
