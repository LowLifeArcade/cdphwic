import { describe, it, expect } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { persistSurplusSubmission, createForecast, confirmForecast } from '../server/utils/surplusReports';
import { editSubmittedRequest, requestMoreInfo, reopenMoreInfoSubmission } from '../server/utils/submittedRequests';
import { getDemoUser } from '../server/utils/session';
import { localDate } from '../shared/surplus';
import type { RequestRecord } from '../shared/domain';
const admin = getDemoUser('admin');
const agency = getDemoUser('agency');
const address = { clinicName: 'North Clinic', addressLine1: '123 North St', addressLine2: '', city: 'Ukiah', state: 'CA', postalCode: '95482' };
const item = { productName: 'Fortini', productForm: 'ready-to-feed', units: 4, expirationDate: '2027-12-01', clinicId: 'north' };
async function fixture() {
    const { db } = surplusDb();
    for (const [id, agencyId, active] of [['north', 10, 1], ['south', 10, 1], ['foreign', 11, 1], ['archived', 10, 0]] as const) {
        await db.prepare('INSERT INTO clinic_addresses(id,agency_id,address_json,active) VALUES(?,?,?,?)').bind(id, agencyId, JSON.stringify({...address, clinicName: id === 'south' ? 'South Clinic' : address.clinicName}), active).run();
    }
    return db;
}
const request = (surplusItems: NonNullable<RequestRecord['surplusItems']> = [item]) => ({ id: 1000099, submissionId: 'clinic-reporting', agencyId: 10, agencyMemberId: 100, status: 'unopened', surplusItems,
    shipping: {...address, attention: 'Maria'}, participantName:'Synthetic Example', participantFirstName:'Synthetic',participantLastName:'Example',participantDob:'2020-01-01',participantFamilyId:123,wicIndividualId:'456',benefitsStartDate:'2026-10-27',requestKind:'new',medicalStatus:'no',productName:'Fortini',productForm:'ready-to-feed',ouncesPrescribed:24,durationMonths:3,diagnosis:'Prematurity',wicFoodRestrictions:'none',doctorPrintedName:'Synthetic Provider',doctorHasSignedOff:true,doctorOfficeName:'Clinic',doctorOfficeAddress:'123 Test Street',doctorOfficePhone:'9165550123',prescriptionSignedDate:'2026-10-26'
} as RequestRecord);
const forecast = { agencyId: 10, requestRef: 'r', formulaName: 'Fortini', form: 'ready-to-feed', expectedUnits: 4, dueDate: localDate(), clinicId: 'north' };
const count = { quantity: 4, date: localDate(), expirationDate: '2027-12-01', confirmerName: 'Staff' };
describe('clinic-aware surplus reports', () => {
    it('snapshots the explicitly selected storage clinic and preserves unspecified reports', async () => {
        const db = await fixture();
        await persistSurplusSubmission(db, 'clinic-reporting', request(), agency);
        const row = await db.prepare('SELECT * FROM surplus_reports').first<any>();
        expect(row).toMatchObject({clinic_id: 'north', clinic_name: 'North Clinic'});
        expect(JSON.parse(row.clinic_address)).toEqual(address);
        await db.prepare('UPDATE clinic_addresses SET address_json=? WHERE id=?').bind(JSON.stringify({...address, addressLine1: 'Changed'}), 'north').run();
        expect(JSON.parse((await db.prepare('SELECT clinic_address FROM surplus_reports').first<string>('clinic_address'))!)).toEqual(address);
        const unspecified = request([{...item, clinicId: undefined}]);
        unspecified.shipping!.clinicId = 'north';
        await persistSurplusSubmission(db, 'unspecified-report', unspecified, agency);
        expect(await db.prepare('SELECT clinic_id FROM surplus_reports WHERE submission_id=?').bind('unspecified-report').first('clinic_id')).toBeNull();
    });
    it.each(['foreign', 'archived', 'missing'])('rejects %s storage clinic without writing reports', async (clinicId) => {
        const db = await fixture();
        await expect(persistSurplusSubmission(db, 'clinic-reporting', request([{...item, clinicId}]), agency)).rejects.toMatchObject({statusCode:400});
        expect(await db.prepare('SELECT COUNT(*) AS n FROM surplus_submissions').first('n')).toBe(0);
    });
    it('treats a clinic-only correction as a new pending report', async () => {
        const db = await fixture(); const previous = request();
        await persistSurplusSubmission(db, previous.submissionId!, previous, agency);
        const edited = await editSubmittedRequest(db, agency, previous, {surplusItems:[{...item,clinicId:'south'}]}, 0);
        expect(edited.surplusItems?.[0]?.clinicId).toBe('south');
        expect(await db.prepare("SELECT clinic_id,clinic_name FROM surplus_reports WHERE status='pending'").first()).toEqual({clinic_id:'south',clinic_name:'South Clinic'});
        expect(await db.prepare("SELECT clinic_id FROM surplus_reports WHERE status='superseded'").first('clinic_id')).toBe('north');
    });
    it('retains the clinic when correcting quantities during a reopened resubmission', async () => {
        const db = await fixture(); const previous = request();
        await persistSurplusSubmission(db, previous.submissionId!, previous, agency);
        const needsInfo = await requestMoreInfo(db, previous, admin, 'Confirm count', 0);
        const reopened = await reopenMoreInfoSubmission(db, needsInfo, admin, needsInfo.revision!);
        const edited = await editSubmittedRequest(db, agency, reopened, {surplusItems:[{...item,units:3}]}, reopened.revision!);
        expect(edited.status).toBe('unopened');
        expect(await db.prepare("SELECT clinic_id,reported_units FROM surplus_reports WHERE status='pending'").first()).toEqual({clinic_id:'north',reported_units:3});
    });
    it('rejects an invalid clinic correction and keeps the pending count', async () => {
        const db = await fixture(); const previous = request();
        await persistSurplusSubmission(db, previous.submissionId!, previous, agency);
        await expect(editSubmittedRequest(db, agency, previous, {surplusItems:[{...item,clinicId:'foreign'}]}, 0)).rejects.toMatchObject({statusCode:400});
        expect(await db.prepare("SELECT clinic_id FROM surplus_reports WHERE status='pending'").first('clinic_id')).toBe('north');
    });
    it('retains the forecast clinic at confirmation and validates an actual-storage override', async () => {
        const db = await fixture();
        const f = await createForecast(db, admin, forecast);
        expect(await db.prepare('SELECT clinic_id,clinic_name FROM surplus_forecasts WHERE id=?').bind(f.id).first()).toEqual({clinic_id:'north',clinic_name:'North Clinic'});
        const report = await confirmForecast(db, agency, {...count, forecastId:f.id});
        expect(await db.prepare('SELECT clinic_id FROM surplus_reports WHERE id=?').bind(report.id).first('clinic_id')).toBe('north');
        const other = await createForecast(db, admin, forecast);
        await expect(confirmForecast(db, agency, {...count,forecastId:other.id,clinicId:'foreign'})).rejects.toMatchObject({statusCode:400});
        const moved = await confirmForecast(db, agency, {...count,forecastId:other.id,clinicId:'south'});
        expect(await db.prepare('SELECT clinic_id FROM surplus_reports WHERE id=?').bind(moved.id).first('clinic_id')).toBe('south');
    });
    it.each(['foreign','archived'])('rejects a forecast at %s clinic', async (clinicId) => {
        const db = await fixture();
        await expect(createForecast(db,admin,{...forecast,clinicId})).rejects.toMatchObject({statusCode:400});
    });
});
