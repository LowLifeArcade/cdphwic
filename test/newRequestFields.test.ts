import { describe, expect, it } from 'vitest';
import { addDiagnosis, validateAgencyFields } from '../shared/newRequestFields';

describe('new request entries', () => {
    it('adds trimmed diagnoses individually without duplicates or blanks', () => {
        expect(addDiagnosis(['Food allergy'], '  GI disorder  ')).toEqual(['Food allergy', 'GI disorder']);
        expect(addDiagnosis(['Food allergy'], 'food allergy')).toEqual(['Food allergy']);
        expect(addDiagnosis([], '  ')).toEqual([]);
    });
    it('requires agency details, insurance, and a Medi-Cal status only for Medi-Cal', () => {
        const valid = { wicFoodRestrictions: 'none', wicStaffFoodRestrictions: '', wicNutritionStaffNotes: '', wicNutritionStaffName: '', ouncesPrescribed: '24', durationMonths: '3', diagnosis: 'Food allergy: Peanut', prescriptionSignedDate: '2026-10-22', familyId: '123', individualId: '456', benefitsStartDate: '2026-10-22', requestKind: 'new', medicalStatus: 'no', mediCalStatus: '', doctorHasSignedOff: true, productForm: 'powder', readyToFeedJustification: '' };
        expect(validateAgencyFields(valid)).toBe('');
        expect(validateAgencyFields({ ...valid, wicFoodRestrictions: '' })).toContain('WIC Food Restrictions');
        const staff = { ...valid, wicFoodRestrictions: 'not-indicated' };
        expect(validateAgencyFields(staff)).toContain('select');
        expect(validateAgencyFields({ ...staff, wicStaffFoodRestrictions: 'none' })).toContain('Name');
        expect(validateAgencyFields({ ...staff, wicStaffFoodRestrictions: 'none', wicNutritionStaffName: 'Sam' })).toBe('');
        expect(validateAgencyFields({ ...staff, wicStaffFoodRestrictions: 'restricted', wicNutritionStaffName: 'Sam' })).toContain('Notes');
        expect(validateAgencyFields({ ...staff, wicStaffFoodRestrictions: 'restricted', wicNutritionStaffName: 'Sam', wicNutritionStaffNotes: 'No milk' })).toBe('');
        for (const key of ['ouncesPrescribed', 'durationMonths', 'diagnosis']) {
            expect(validateAgencyFields({ ...valid, [key]: '' })).not.toBe('');
        }
        expect(validateAgencyFields({ ...valid, ouncesPrescribed: '0' })).not.toBe('');
        expect(validateAgencyFields({ ...valid, prescriptionSignedDate: '' })).toBe('Enter Date Signed.');
        for (const key of ['familyId', 'individualId', 'benefitsStartDate', 'requestKind', 'medicalStatus']) {
            expect(validateAgencyFields({ ...valid, [key]: '' })).not.toBe('');
        }
        expect(validateAgencyFields({ ...valid, medicalStatus: 'yes' })).toContain('Medi-Cal Status');
        expect(validateAgencyFields({ ...valid, medicalStatus: 'yes', mediCalStatus: 'Denied' })).toBe('');
        expect(validateAgencyFields({ ...valid, doctorHasSignedOff: false })).toContain('signature');
        expect(validateAgencyFields({ ...valid, productForm: 'ready-to-feed' })).toContain('ready-to-feed');
        expect(validateAgencyFields({ ...valid, productForm: 'ready-to-feed', readyToFeedJustification: 'Unable to mix powder' })).toBe('');
    });
});
