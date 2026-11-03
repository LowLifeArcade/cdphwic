import { describe, expect, it } from 'vitest';
import {
    canGenerateAuthorizationForm,
    getApprovalStatus,
    canSelectShippedStatus,
    getNextBenefitMonth,
    subsequentIssuanceMonths,
    validateBenefitIssuances,
} from '../shared/requestOperations';

describe('request operations', () => {
    it('only offers shipped with saved shipping information and shipment history', () => {
        const shipping = { eta: '2026-10-20', trackingNumbers: [{ number: '123', carrier: 'ups' as const }] };
        expect(canSelectShippedStatus({ ...shipping, status: 'opened' })).toBe(false);
        expect(canSelectShippedStatus({ ...shipping, status: 'shipped' })).toBe(true);
        expect(canSelectShippedStatus({ ...shipping, status: 'needs_info', shippedAt: '2026-10-16T12:00:00Z' })).toBe(true);
        expect(canSelectShippedStatus({ ...shipping, eta: '', shippedAt: '2026-10-16T12:00:00Z' })).toBe(false);
        expect(canSelectShippedStatus({ ...shipping, trackingNumbers: [], shippedAt: '2026-10-16T12:00:00Z' })).toBe(false);
    });

    it.each(['opened', 'needs_info', 'unopened', 'denied'] as const)('moves %s to in progress when approved', (status) => {
        expect(getApprovalStatus(status)).toBe('in_progress');
    });

    it.each(['pending', 'in_progress', 'approved', 'shipped', 'complete', 'damaged', 'missing'] as const)('preserves %s when approved', (status) => {
        expect(getApprovalStatus(status)).toBe(status);
    });

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

it('keeps issuance months after their preceding row, including year rollover and blank resets',()=>{
 const rows=[{month:'2026-12',quantity:12},{month:'2026-11',quantity:8},{month:'2026-12',quantity:4}];
 expect(subsequentIssuanceMonths(rows,0)).toEqual([{month:'2026-12',quantity:12},{month:'2027-01',quantity:8},{month:'2027-02',quantity:4}]);
 expect(subsequentIssuanceMonths([{month:'',quantity:12},...rows.slice(1)],0).map(row=>row.month)).toEqual(['','','']);
 expect(rows[1]!.month).toBe('2026-11');
});
