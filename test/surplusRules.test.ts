import { describe, expect, it } from 'vitest';
import { variantKey, availableUnits, canAllocate, validateUnits, daysRemaining, surplusDisposition, localDate, surplusCatalogVariants, surplusBarcodeMatches, defaultSurplusCatalogOption } from '../shared/surplus';
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
    it.each([
        ['2026-12-09', 'destruction'],
        ['2026-12-10', 'donation'],
        ['2026-12-25', 'donation'],
        ['2026-12-26', undefined],
        ['', undefined],
    ])('classifies expiration %s consistently for inventory and notices', (expiry, expected) => {
        expect(surplusDisposition(expiry, '2026-10-26')).toBe(expected);
    });
    it('allows allocation only when more than 60 days remain',()=>{
        expect(canAllocate({onHand:10,reserved:0,expiredUnits:0,expirationDate:'2026-12-25'},1,'2026-10-26')).toBe(false);
        expect(canAllocate({onHand:10,reserved:0,expiredUnits:0,expirationDate:'2026-12-26'},1,'2026-10-26')).toBe(true);
    });
    it('matches exact configured unit and case barcodes without losing leading zeroes', () => {
        const product = { form: 'ready-to-feed', genericFields: { unitUpc: '012345678905', caseBarcode: '10012345678902' } } as any;
        expect(surplusBarcodeMatches([product], '012345678905')).toEqual([{ product, field: 'unitUpc' }]);
        expect(surplusBarcodeMatches([product], '10012345678902')).toEqual([{ product, field: 'caseBarcode' }]);
        expect(surplusBarcodeMatches([product], '12345678905')).toEqual([]);
        expect(surplusBarcodeMatches([{ ...product, active: false }], '012345678905')).toEqual([]);
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
    it('retains multiple package sizes on one formula and form variant',()=>{
        expect(surplusCatalogVariants([
            {id:1,name:'Similac NeoSure',form:'ready-to-feed',flavor:'Unflavored',packaging:'Bottle',yield:2,active:true},
            {id:2,name:'Similac NeoSure',form:'ready-to-feed',flavor:'Unflavored',packaging:'Bottle',yield:32,active:true},
        ] as any)).toEqual([{formulaName:'Similac NeoSure',form:'ready-to-feed',flavor:'Unflavored',packagings:['2 fl oz Bottle','32 fl oz Bottle']}]);
    });
    it('defaults a catalog choice only when there is exactly one option',()=>{
        expect(defaultSurplusCatalogOption(['powder'])).toBe('powder');
        expect(defaultSurplusCatalogOption(['powder','ready-to-feed'])).toBeUndefined();
        expect(defaultSurplusCatalogOption([])).toBeUndefined();
    });
    it('keeps package sizes as separate inventory identities while preserving legacy keys',()=>{
        const base={formulaName:'Similac NeoSure',form:'ready-to-feed',flavor:'',expirationDate:'2027-01-01'};
        expect(variantKey(base)).not.toBe(variantKey({...base,packaging:'2 fl oz'}));
        expect(variantKey({...base,packaging:'2 fl oz'})).not.toBe(variantKey({...base,packaging:'32 fl oz'}));
        expect(variantKey({...base,packaging:' 2   FL OZ '})).toBe(variantKey({...base,packaging:'2 fl oz'}));
    });
});
