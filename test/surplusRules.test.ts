import { describe, expect, it } from 'vitest';
import { variantKey, availableUnits, canAllocate, validateUnits, daysRemaining, localDate, surplusCatalogVariants, defaultSurplusCatalogOption } from '../shared/surplus';
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
    it('allows allocation only when more than 60 days remain',()=>{
        expect(canAllocate({onHand:10,reserved:0,expiredUnits:0,expirationDate:'2026-12-25'},1,'2026-10-26')).toBe(false);
        expect(canAllocate({onHand:10,reserved:0,expiredUnits:0,expirationDate:'2026-12-26'},1,'2026-10-26')).toBe(true);
    });
    it('provides distinct active catalog formula, form, and flavor variants for surplus entries', () => {
        const products = [
            { id: 1, name: 'Fortini', form: 'ready-to-feed', flavor: 'Vanilla', active: true },
            { id: 2, name: ' Fortini ', form: 'ready-to-feed', flavor: 'Vanilla', active: true },
            { id: 3, name: 'Fortini', form: 'ready-to-feed', flavor: 'Chocolate', active: true },
            { id: 4, name: 'Old Formula', form: 'powder', flavor: '', active: false },
        ] as any;
        expect(surplusCatalogVariants(products)).toEqual([
            { formulaName: 'Fortini', form: 'ready-to-feed', flavor: 'Chocolate', packagings: [''] },
            { formulaName: 'Fortini', form: 'ready-to-feed', flavor: 'Vanilla', packagings: [''] },
        ]);
    });
    it('defaults a catalog choice only when there is exactly one option',()=>{
        expect(defaultSurplusCatalogOption(['powder'])).toBe('powder');
        expect(defaultSurplusCatalogOption(['powder','ready-to-feed'])).toBeUndefined();
        expect(defaultSurplusCatalogOption([])).toBeUndefined();
    });
});
