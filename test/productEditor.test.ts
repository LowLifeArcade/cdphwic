import { describe, expect, it } from 'vitest';
import { productEditorFields, createProductEditor, productEditorBody, productEditorOptions } from '../shared/productEditor';
import type { ProductRecord } from '../shared/domain';
const product = { id: 1, productId: 'OLD-ID', productCode: '00123', name: 'Formula', form: 'powder', category: 'exempt', coverage: ['wic'], unitPrice: 2, poPrice: 10, casesApproved: 20, casesUsed: 3, supplierReference: 'Keep supplier', fdaClass: 'Legacy FDA', wicClass: 'A', st: 'S', infantToddler: 'T', genericFields: { source: 'import' } } as ProductRecord;
describe('product formula editor', () => {
    it('uses the corrected upload order and only the requested fields', () => {
        expect(productEditorFields.map(field => field.label)).toEqual(['Formula Description', 'Manufacturer', 'Formula Name', 'Form', 'Flavor', 'Packaging', 'Product Number', 'Units Per Case', 'Yield', 'Covered by Medi-Cal', 'McKesson PO', 'McKesson Price', 'FDA Class', 'WIC Category', 'S/T', 'Infant/Toddler']);
    });
    it.each([
        ['fdaClass', ['Exempt', 'Non-exempt', 'Not infant']],
        ['wicClass', ['Exempt', 'Nutritional', 'Contract', 'SNC']],
        ['st', ['Standard', 'Therapeutic']],
        ['infantToddler', ['Infant', 'Toddler', 'Adult']],
    ] as const)('provides fixed %s options while retaining unfamiliar saved values', (key, expected) => {
        const field = productEditorFields.find(field => field.key === key)!;
        expect(productEditorOptions(field, '')).toEqual(['', ...expected]);
        expect(productEditorOptions(field, 'Legacy value')).toEqual(['', ...expected, 'Legacy value']);
        expect(productEditorOptions(field, expected[0])).toEqual(['', ...expected]);
    });
    it('preserves hidden legacy values and untouched classifications when saving an edit', () => {
        const form = createProductEditor(product);
        form.formulaDescription = 'New description';
        expect(productEditorBody(product, form)).toMatchObject({ ...product, formulaDescription: 'New description' });
    });
    it('supports blank numeric/classification fields and leading zeroes', () => {
        const form = createProductEditor(product);
        form.unitsPerCase = ''; form.yield = ''; form.mcKessonPrice = ''; form.fdaClass = '';
        expect(productEditorBody(product, form)).toMatchObject({ productCode: '00123', unitsPerCase: null, yield: null, mcKessonPrice: null, fdaClass: '' });
    });
    it('synchronizes explicit Medi-Cal choices and preserves coverage when unspecified', () => {
        const form = createProductEditor(product);
        form.coveredByMediCal = 'yes';
        expect(productEditorBody(product, form).coverage).toEqual(['wic', 'medical']);
        const medical = { ...product, coverage: ['wic', 'medical'] } as ProductRecord;
        form.coveredByMediCal = 'no';
        expect(productEditorBody(medical, form).coverage).toEqual(['wic']);
        form.coveredByMediCal = '';
        expect(productEditorBody(medical, form)).toMatchObject({ coveredByMediCal: null, coverage: ['wic', 'medical'] });
    });
});

it('persists formula edits without resetting stored case counts, prices, or identifiers', async () => {
    const { productDb } = await import('./helpers/productDb');
    const { createProduct, getProduct, updateProduct } = await import('../server/utils/productRepository');
    const { db } = productDb();
    const saved = await createProduct(db, { ...product, unitsPerCase: 6 });
    const form = createProductEditor(saved);
    form.formulaDescription = 'Updated formula description';
    form.fdaClass = 'Non-exempt'; form.wicClass = 'SNC'; form.st = 'Therapeutic'; form.infantToddler = 'Adult';
    form.coveredByMediCal = 'yes';
    await updateProduct(db, saved.id, productEditorBody(saved, form));
    expect(await getProduct(db, saved.id)).toMatchObject({ productId: 'OLD-ID', productCode: '00123', category: 'exempt', unitPrice: 2, poPrice: 10, casesApproved: 20, casesUsed: 3, casesRemaining: 17, supplierReference: 'Keep supplier', genericFields: { source: 'import' }, formulaDescription: 'Updated formula description', fdaClass: 'Non-exempt', wicClass: 'SNC', st: 'Therapeutic', infantToddler: 'Adult', coveredByMediCal: true, coverage: ['wic', 'medical'] });
});

it('clears optional numbers through the JSON save path while retaining hidden quantities', async () => {
    const { productDb } = await import('./helpers/productDb');
    const { createProduct, getProduct, updateProduct } = await import('../server/utils/productRepository');
    const { db } = productDb();
    const saved = await createProduct(db, { ...product, unitsPerCase: 6, yield: 8, mcKessonPrice: 42 });
    const form = createProductEditor(saved);
    form.unitsPerCase = ''; form.yield = ''; form.mcKessonPrice = '';
    await updateProduct(db, saved.id, JSON.parse(JSON.stringify(productEditorBody(saved, form))));
    expect(await getProduct(db, saved.id)).toMatchObject({ unitsPerCase: undefined, yield: undefined, mcKessonPrice: undefined, casesApproved: 20, casesUsed: 3, casesRemaining: 17 });
});
