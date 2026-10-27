import { describe, expect, it } from 'vitest';
import { variantKey, availableUnits, canAllocate, validateUnits, daysRemaining, localDate } from '../shared/surplus';
describe('surplus rules', () => {
    it('identifies variants and excludes quarantine from availability', () => {
        const v = { formulaName: ' Fortini ', form: 'ready-to-feed', flavor: '', expirationDate: '2027-01-01' };
        expect(variantKey(v)).toBe(variantKey({ ...v, formulaName: 'fortini' }));
        expect(variantKey(v)).not.toBe(variantKey({ ...v, flavor: 'Vanilla' }));
        expect(availableUnits({ onHand: 10, reserved: 3, expiredUnits: 99 })).toBe(7);
        expect(
            canAllocate({ onHand: 10, reserved: 3, expiredUnits: 99, expirationDate: '2027-01-01' }, 8, '2026-10-26'),
        ).toBe(false);
        for (const n of [0, -1, 1.5, NaN]) expect(validateUnits(n)).not.toBe('');
    });
    it('uses LA calendar dates and the corrected donation boundaries', () => {
        expect(localDate(new Date('2026-10-27T02:00:00Z'))).toBe('2026-10-26');
        expect(daysRemaining('2026-12-25', '2026-10-26')).toBe(60);
        expect(daysRemaining('2026-12-24', '2026-10-26')).toBe(59);
        expect(daysRemaining('2026-10-25', '2026-10-26')).toBe(-1);
    });
});
