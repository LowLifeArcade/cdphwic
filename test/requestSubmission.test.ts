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
        for (const key of ['participantFirstName', 'participantLastName', 'participantDob', 'participantFamilyId', 'wicIndividualId', 'benefitsStartDate', 'requestKind', 'medicalStatus', 'productName', 'productForm', 'ouncesPrescribed', 'durationMonths', 'diagnosis', 'wicFoodRestrictions', 'doctorPrintedName', 'doctorHasSignedOff', 'doctorOfficeName', 'doctorOfficeAddress', 'doctorOfficePhone', 'prescriptionSignedDate']) {
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

    it('rejects catalog names submitted as Other for the first formula', () => {
        expect(validateRequestSubmission({...complete, genericFields:{otherFormulaName:'Fortini'}})).toMatch(/already.*list/i);
    });

    it('validates each additional formula and permits RTF-only products without a reason', () => {
        const first = { productName: 'Fortini', productForm: 'ready-to-feed' as const, ouncesPrescribed: 24 };
        const second = { productName: 'Similac NeoSure', productForm: 'powder' as const, ouncesPrescribed: 12 };
        expect(validateRequestSubmission({ ...complete, genericFields: {}, requestedFormulas: [first, second] })).toBe('');
        expect(validateRequestSubmission({ ...complete, requestedFormulas: [first, { ...second, ouncesPrescribed: 0 }] })).toContain('Formula 2');
        expect(validateRequestSubmission({ ...complete, requestedFormulas: [first, { ...second, productForm: 'ready-to-feed' }] })).toContain('reason(s)');
        expect(validateRequestSubmission({ ...complete, surplusItems: [{ productName: 'Fortini', productForm: 'ready-to-feed', units: 3, expirationDate: '2027-01-01' }] })).toBe('');
        expect(validateRequestSubmission({ ...complete, surplusItems: [{ productName: 'Unknown', units: 3, expirationDate: '' }] })).toContain('surplus');
    });

    it('retains surplus forms and flavors and rejects invalid forms and too many months', () => {
        const surplus = { productName: 'Kate Farms Pediatric Std 1.2 Cal', productForm: 'ready-to-feed' as const, flavor: 'Vanilla', units: 3, expirationDate: '2027-01-01' };
        const request = { ...complete, requestedFormulas: [{ productName: surplus.productName, productForm: surplus.productForm, ouncesPrescribed: 24 }], surplusItems: [surplus] };
        expect(validateRequestSubmission(request)).toBe('');
        expect(validateRequestSubmission({ ...request, surplusItems: [{ ...surplus, productForm: 'powder' }] })).toContain('surplus');
        expect(validateRequestSubmission({ ...complete, benefitMonthsRequested: ['2026-01', '2026-02', '2026-03', '2026-04'] })).toContain('3');
    });

    it('rejects duplicate requested formulas and more than two formulas at submission', () => {
        const formula = { productName: 'Fortini', productForm: 'ready-to-feed' as const, ouncesPrescribed: 24 };
        expect(validateRequestSubmission({ ...complete, requestedFormulas: [formula, formula] })).toContain('not be identical');
        expect(validateRequestSubmission({ ...complete, requestedFormulas: [formula, formula, formula] })).toContain('2 formulas');
    });

    it('requires diagnosis details and WIC staff completion when the HCP left both boxes blank', () => {
        expect(validateRequestSubmission({ ...complete, diagnosis: 'Food allergy' })).toContain('details');
        expect(validateRequestSubmission({ ...complete, wicFoodRestrictions: 'not-indicated' })).toContain('select');
        expect(validateRequestSubmission({ ...complete, wicFoodRestrictions: 'not-indicated', wicStaffFoodRestrictions: 'restricted', wicNutritionStaffName: 'Sam', wicNutritionStaffNotes: 'No milk' })).toBe('');
    });
});
