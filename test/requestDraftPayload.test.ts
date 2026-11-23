import { expect, it } from 'vitest';
import { blankRequestForm } from '../app/features/requests/requestForm';
import { serializeRequestDraft, restoreRequestDraft } from '../app/features/requests/requestDraft';

it('round-trips incomplete form values, pending diagnosis text, formulas, surplus clinics, shipping and stable submission ID', () => {
    const form = { ...blankRequestForm(), patientFirstName: 'First', doctorHasSignedOff: false, ouncesPrescribed: '' };
    const extras = { submissionId: 'stable-id', diagnosisInput: 'Food allergy', diagnosisDetails: 'Peanut', additionalFormulas: [{ formulaName: 'Other', otherFormulaName: 'Custom', productForm: 'powder', formulaFlavor: '', ouncesPrescribed: '', readyToFeedJustification: '' }], surplusEntries: [{ productName: 'Fortini', productForm: 'ready-to-feed', flavor: '', units: '2', expirationDate: '', clinicId: 'storage-clinic' }], requestedMonths: ['2026-11'], shipping: { clinicId: 'destination', addressLine1: '123 Main', city: 'City', state: 'CA', postalCode: '95814' } };
    const stored = serializeRequestDraft(form, extras);
    expect(stored._submissionId).toBe('stable-id');
    const restored = restoreRequestDraft(stored);
    expect(restored).toEqual({ form, ...extras });
    expect(restored.form).not.toHaveProperty('_shipping');
    expect(form).not.toHaveProperty('_submissionId');
});
it('restores legacy drafts with missing extras without inventing a shipping or submission identity', () => {
    expect(restoreRequestDraft({ patientFirstName: 'Legacy', doctorHasSignedOff: false })).toEqual({
        form: { patientFirstName: 'Legacy', doctorHasSignedOff: false }, submissionId: undefined, shipping: undefined,
        diagnosisInput: '', diagnosisDetails: '', additionalFormulas: [], surplusEntries: [], requestedMonths: [],
    });
});
it('does not silently discard malformed saved JSON', () => {
    expect(() => restoreRequestDraft({ _additionalFormulas: 'broken' })).toThrow();
});
