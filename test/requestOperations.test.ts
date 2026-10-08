import { describe, expect, it } from 'vitest';
import {
    canGenerateAuthorizationForm,
    getNextBenefitMonth,
    validateBenefitIssuances,
} from '../shared/requestOperations';

describe('request operations', () => {
    it('validates positive, unique, chronological benefit allocations', () => {
        expect(
            validateBenefitIssuances([
                { month: '2026-10', quantity: 12 },
                { month: '2026-11', quantity: 6 },
            ]),
        ).toEqual([]);
        expect(validateBenefitIssuances([{ month: '2026-10', quantity: 0 }])).toContain('Each month needs a positive quantity.');
        expect(
            validateBenefitIssuances([
                { month: '2026-11', quantity: 6 },
                { month: '2026-10', quantity: 12 },
            ]),
        ).toContain('Benefit months must be in chronological order.');
    });

    it('returns the next month after the latest allocation', () => {
        expect(getNextBenefitMonth([{ month: '2026-10', quantity: 12 }])).toBe('2026-11');
        expect(getNextBenefitMonth([])).toBe('');
    });

    it('requires approval and an order date before generating an authorization form', () => {
        expect(canGenerateAuthorizationForm({ status: 'approved', dateOrdered: '2026-10-07' })).toBe(true);
        expect(canGenerateAuthorizationForm({ status: 'approved' })).toBe(false);
        expect(canGenerateAuthorizationForm({ status: 'pending', dateOrdered: '2026-10-07' })).toBe(false);
    });
});
