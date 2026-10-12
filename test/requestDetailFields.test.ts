import { describe, expect, it } from 'vitest';
import {
    normalizeRequestedMonths,
    validateRequestDetailNumbers,
    validateSurplusItems,
} from '../shared/requestDetailFields';

describe('request detail fields', () => {
    it('normalizes requested months to unique chronological YYYY-MM values', () => {
        expect(normalizeRequestedMonths(['2026-12', '2026-01', '2026-12'])).toEqual(['2026-01', '2026-12']);
        expect(normalizeRequestedMonths(['2026-1', 'not-a-month'])).toEqual([]);
    });

    it('rejects negative staff and surplus numbers', () => {
        expect(validateRequestDetailNumbers({ approvedCases: -1, expectedSurplus: 2 })).toEqual([
            'Approved cases cannot be negative.',
        ]);
        expect(validateRequestDetailNumbers({ casesOrdered: 1, expectedSurplus: -1 })).toEqual([
            'Expected surplus cannot be negative.',
        ]);
    });

    it('requires complete surplus rows', () => {
        expect(validateSurplusItems([{ productName: 'Formula', units: 2, expirationDate: '' }])).toEqual([
            'Each surplus row needs a product, number of units, and expiration date.',
        ]);
        expect(validateSurplusItems([{ productName: 'Formula', units: 2, expirationDate: '2026-10-01' }])).toEqual([]);
    });
});
