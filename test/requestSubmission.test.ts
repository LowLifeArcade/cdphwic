import { describe, expect, it } from 'vitest';
import { validateRequestSubmission } from '../shared/requestSubmission';
import type { RequestRecord } from '../shared/domain';
const complete: Partial<RequestRecord> = {
    participantFirstName: 'Ana', participantLastName: 'Example', participantDob: '2020-01-01',
    participantFamilyId: 123, wicIndividualId: '456', benefitsStartDate: '2026-10-22', requestKind: 'new',
    medicalStatus: 'no', productName: 'Fortini', productForm: 'ready-to-feed', ouncesPrescribed: 24, durationMonths: 3,
    diagnosis: 'Food allergy: Peanut', wicFoodRestrictions: 'none', doctorPrintedName: 'Dr. Example',
    doctorHasSignedOff: true, doctorOfficeName: 'Clinic', doctorOfficeAddress: '123 Main St', doctorOfficePhone: '9165550123',
    prescriptionSignedDate: '2026-10-22', genericFields: { readyToFeedJustification: 'Unable to mix powder' },
};

describe('submission requirements', () => {
    it('accepts a complete request and rejects omissions even outside the browser', () => {
        expect(validateRequestSubmission(complete)).toBe('');
        for (const key of ['participantFirstName', 'participantLastName', 'participantDob', 'participantFamilyId', 'wicIndividualId', 'benefitsStartDate', 'requestKind', 'medicalStatus', 'productName', 'productForm', 'ouncesPrescribed', 'durationMonths', 'diagnosis', 'wicFoodRestrictions', 'doctorPrintedName', 'doctorHasSignedOff', 'doctorOfficeName', 'doctorOfficeAddress', 'doctorOfficePhone', 'prescriptionSignedDate', 'genericFields']) {
            expect(validateRequestSubmission({ ...complete, [key]: undefined }), key).not.toBe('');
        }
    });
    it('accepts a named Other formula while preserving restrictions for listed formulas', () => {
        const custom = { ...complete, productName: 'Unlisted Nutrition', productForm: 'powder' as const, genericFields: { otherFormulaName: 'Unlisted Nutrition' } };
        expect(validateRequestSubmission(custom)).toBe('');
        expect(validateRequestSubmission({ ...custom, productName: '' })).not.toBe('');
        expect(validateRequestSubmission({ ...custom, productName: 'Other', genericFields: {} })).not.toBe('');
        expect(validateRequestSubmission({ ...custom, productName: 'Fortini', productForm: 'powder', genericFields: { otherFormulaName: 'Fortini' } })).not.toBe('');
    });

    it('requires diagnosis details and WIC staff completion when the HCP left both boxes blank', () => {
        expect(validateRequestSubmission({ ...complete, diagnosis: 'Food allergy' })).toContain('details');
        expect(validateRequestSubmission({ ...complete, wicFoodRestrictions: 'not-indicated' })).toContain('select');
        expect(validateRequestSubmission({ ...complete, wicFoodRestrictions: 'not-indicated', wicStaffFoodRestrictions: 'restricted', wicNutritionStaffName: 'Sam', wicNutritionStaffNotes: 'No milk' })).toBe('');
    });
});
