import { expect, it } from 'vitest';
import { blankRequestForm } from '../app/features/requests/requestForm';
import { requestSubmissionBody, type SubmissionContext } from '../app/features/requests/requestSubmissionBody';

const context = (): SubmissionContext => ({
    draftId: 12, revision: 3, removePrescriptionAttachment: true, submissionId: 'stable-id', agencyId: 10, agencyMemberId: 100,
    shipping: { addressLine1: '123 Main', city: 'Sacramento', state: 'CA', postalCode: '95814' },
    benefitMonthsRequested: ['2026-11'], productId: 7, productName: 'Fortini',
    requestedFormulas: [{ productName: 'Fortini', productForm: 'ready-to-feed', ouncesPrescribed: 8 }],
    surplusItems: [{ productName: 'Fortini', productForm: 'ready-to-feed', flavor: '', units: '2', expirationDate: '' }],
    hasFlavor: true, isOtherFormula: false, prescriptionKey: 'upload-key',
});
const payload = (form: ReturnType<typeof blankRequestForm>, input = context(), saveOnly = false) => JSON.parse(requestSubmissionBody(form, input, saveOnly).get('request') as string);

it('serializes create/edit metadata, formulas, quantities and normalized provider phone', () => {
    const form = { ...blankRequestForm(), patientFirstName: 'First', patientLastName: 'Last', familyId: '42', individualId: '001', doctorOfficePhone: '(916) 555-1234', ouncesPrescribed: '8', durationMonths: '3', formulaFlavor: ' Vanilla ' };
    const result = payload(form);
    expect(result).toMatchObject({ saveOnly: false, draftId: 12, revision: 3, removePrescriptionAttachment: true, submissionId: 'stable-id', agencyId: 10, agencyMemberId: 100, participantName: 'First Last', participantFamilyId: 42, wicIndividualId: '001', doctorOfficePhone: '9165551234', ouncesPrescribed: 8, durationMonths: 3, formulaFlavor: 'Vanilla', prescriptionKey: 'upload-key', status: 'unopened' });
    expect(result.requestedFormulas).toEqual(context().requestedFormulas);
    expect(result.surplusItems[0].units).toBe(2);
    expect(payload(form, context(), true).saveOnly).toBe(true);
});
it('omits optional blanks and clears fields whose conditional selection is no longer active', () => {
    const form = { ...blankRequestForm(), medicalStatus: 'no', mediCalStatus: 'Denied', breastfeedingDiscontinuedDate: '2026-01-01', otherFormulaName: 'Old name', wicFoodRestrictionDetails: 'Old restriction', wicNutritionStaffNotes: 'Old notes' };
    const result = payload(form, { ...context(), productId: undefined, hasFlavor: false, prescriptionKey: '' });
    expect(result.productId).toBe(-1);
    for (const key of ['participantFamilyId', 'wicIndividualId', 'mediCalStatus', 'formulaFlavor', 'prescriptionKey', 'wicStaffFoodRestrictions']) expect(result).not.toHaveProperty(key);
    expect(result).toMatchObject({ breastfeedingDiscontinuedDate: '', wicFoodRestrictionDetails: '', wicNutritionStaffNotes: '', genericFields: { otherFormulaName: '' } });
});
it('retains active conditional data without mutating the form or context', () => {
    const form = { ...blankRequestForm(), medicalStatus: 'yes', mediCalStatus: 'Denied', breastfeedingStatus: 'Discontinued BF' as const, breastfeedingDiscontinuedDate: '2026-01-01', otherFormulaName: ' Custom formula ', wicFoodRestrictions: 'not-indicated' as const, wicStaffFoodRestrictions: 'restricted' as const, wicNutritionStaffNotes: 'Required notes' };
    const input = { ...context(), isOtherFormula: true };
    const before = structuredClone({ form, input });
    expect(payload(form, input)).toMatchObject({ mediCalStatus: 'Denied', breastfeedingDiscontinuedDate: '2026-01-01', wicStaffFoodRestrictions: 'restricted', wicNutritionStaffNotes: 'Required notes', genericFields: { otherFormulaName: 'Custom formula' } });
    expect({ form, input }).toEqual(before);
    expect(blankRequestForm()).not.toBe(blankRequestForm());
});
