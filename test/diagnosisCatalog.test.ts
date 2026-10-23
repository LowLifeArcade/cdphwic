import { describe, expect, it } from 'vitest';
import { diagnosisCatalog, findDiagnosis, validateDiagnoses } from '../shared/diagnosisCatalog';

describe('diagnosis choices', () => {
    it('requires details for all seven specified diagnoses', () => {
        for (const choice of diagnosisCatalog.filter((item) => item.detail)) {
            expect(validateDiagnoses(choice.name)).toContain('Provide details');
            expect(validateDiagnoses(`${choice.name}: Specific condition`)).toBe('');
        }
    });
    it('accepts the four diagnoses without details and recognizes PDF labels', () => {
        for (const choice of diagnosisCatalog.filter((item) => !item.detail)) expect(validateDiagnoses(choice.name)).toBe('');
        expect(findDiagnosis('dysphagia')?.name).toBe('Dysphagia');
        expect(validateDiagnoses('Gastrointestinal disorder')).toContain('details');
        expect(validateDiagnoses('Malabsorption: Fat')).toBe('');
        expect(validateDiagnoses('')).not.toBe('');
    });
});
