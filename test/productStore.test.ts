import { describe, expect, it } from 'vitest';
import { createProduct, updateProduct, updateProducts, validateProductInput } from './helpers/productStore';

describe('product store', () => {
    it('validates required product fields and numeric values', () => {
        expect(
            validateProductInput({
                name: '',
                productCode: '',
                form: 'powder',
                category: 'unknown',
                unitsPerCase: 0,
            }),
        ).toEqual([
            'Product ID is required.',
            'Product code is required.',
            'Name is required.',
            'Category must be standard, exempt, or nutritional.',
            'Units per case must be a positive number.',
        ]);
    });

    it('creates a product with a generated id and normalized optional fields', () => {
        const product = createProduct({
            name: 'Test Formula',
            productId: 'TEST-001',
            productCode: 'TEST-CODE-001',
            form: 'powder',
            category: 'standard',
            unitsPerCase: 12,
            unitPrice: 10,
            supplierReference: 'TEST-SUPPLIER',
        });

        expect(product).toMatchObject({
            name: 'Test Formula',
            productId: 'TEST-001',
            productCode: 'TEST-CODE-001',
            category: 'standard',
            unitsPerCase: 12,
            unitPrice: 10,
            supplierReference: 'TEST-SUPPLIER',
        });
        expect(product.id).toBeGreaterThan(304);
    });

    it('replaces quantities for existing products by productId', () => {
        const updated = updateProducts([
            {
                productId: 'PROD-301',
                casesApproved: 200,
                casesUsed: 9,
            },
        ]);

        expect(updated[0]).toMatchObject({
            productId: 'PROD-301',
            casesApproved: 200,
            casesUsed: 9,
        });
        expect(updated[0].casesRemaining).toBe(191);
    });

    it('updates an existing product by internal id', () => {
        const updated = updateProduct(301, {
            name: 'Nutramigen Updated',
            productId: 'PROD-301',
            productCode: '166802',
            form: 'powder',
            category: 'nutritional',
            unitsPerCase: 6,
            unitPrice: 42.5,
            poPrice: 78.34,
            casesApproved: 210,
            casesUsed: 10,
            coverage: ['wic', 'medical'],
        });

        expect(updated).toMatchObject({ name: 'Nutramigen Updated', casesRemaining: 200 });
    });
});

it('does not partially import a batch containing invalid or missing identifiers', async () => {
    const { createProducts, listProducts } = await import('./helpers/productStore');
    const before = listProducts().length;
    expect(() => createProducts([{ name: 'Valid batch', productId: 'BATCH-VALID', productCode: 'BATCH-VALID', form: 'powder', category: 'standard', unitsPerCase: 6 }, { name: 'Invalid batch' } as never])).toThrow('Row 3');
    expect(listProducts()).toHaveLength(before);
});

it('retains imported metadata when a legacy edit changes core fields only', () => {
    const product = createProduct({ name: 'Metadata formula', productId: 'META-1', productCode: 'META-1', form: 'powder', category: 'standard', unitsPerCase: 6, yield: 8, flavor: 'Vanilla', packaging: 'can', formulaDescription: 'Full description', manufacturer: 'Maker', mcKessonPo: 'PO', mcKessonPrice: 20, coveredByMediCal: false, fdaClass: 'A', wicClass: 'B', st: 'S', infantToddler: 'Toddler' });
    const edited = updateProduct(product.id, { name: product.name, productId: product.productId, productCode: product.productCode, form: product.form, category: product.category, unitsPerCase: 12 });
    expect(edited).toMatchObject({ unitsPerCase: 12, yield: 8, flavor: 'Vanilla', packaging: 'can', formulaDescription: 'Full description', manufacturer: 'Maker', mcKessonPo: 'PO', mcKessonPrice: 20, coveredByMediCal: false, fdaClass: 'A', wicClass: 'B', st: 'S', infantToddler: 'Toddler' });
});


it('still clears editable prices when a legacy form omits empty price values', () => {
    const original = createProduct({ name: 'Clear price formula', productId: 'PRICE-CLEAR', productCode: 'PRICE-CLEAR', form: 'powder', category: 'standard', unitsPerCase: 6, unitPrice: 10, poPrice: 15, packaging: 'can' });
    const edited = updateProduct(original.id, { name: original.name, productId: original.productId, productCode: original.productCode, form: original.form, category: original.category, unitsPerCase: 6 });
    expect(edited.unitPrice).toBeUndefined();
    expect(edited.poPrice).toBeUndefined();
    expect(edited.packaging).toBe('can');
});

it('keeps inactive products out of the catalog while retaining historical lookup data', async () => {
    const { listProducts, getProduct } = await import('./helpers/productStore');
    const archived = createProduct({ name: 'Archived fixture', productId: 'ARCHIVED-FIXTURE', productCode: 'ARCHIVED-FIXTURE', form: 'powder', category: 'standard', unitsPerCase: 6, active: false });
    expect(listProducts().some(product => product.id === archived.id)).toBe(false);
    expect(listProducts({ includeInactive: true }).some(product => product.id === archived.id)).toBe(true);
    expect(getProduct(archived.id).unitsPerCase).toBe(6);
});

it('deletes a product from active selection while preserving historical data and allowing its number to be reused', async () => {
    const { deleteProduct, listProducts, getProduct } = await import('./helpers/productStore');
    const input = { name: 'Delete fixture', productId: 'DELETE-FIXTURE', productCode: 'DELETE-FIXTURE', form: 'powder' as const, category: 'standard' as const, unitsPerCase: 6 };
    const product = createProduct(input);
    expect(deleteProduct(product.id)).toMatchObject({ id: product.id, active: false });
    expect(listProducts().some(row => row.id === product.id)).toBe(false);
    expect(getProduct(product.id)).toMatchObject({ productCode: 'DELETE-FIXTURE', unitsPerCase: 6 });
    expect(createProduct(input).id).not.toBe(product.id);
    expect(() => deleteProduct(-1)).toThrow('No product found');
});

it('edits spreadsheet metadata and explicitly clears optional prices, yield, and coverage status', () => {
    const original = createProduct({ name: 'Edit spreadsheet fixture', productId: 'EDIT-SHEET', productCode: 'EDIT-SHEET', form: 'powder', category: 'standard', unitsPerCase: 6, yield: 8, formulaDescription: 'Original description', flavor: 'Vanilla', packaging: 'Can', manufacturer: 'Maker', mcKessonPo: 'PO-001', mcKessonPrice: 25, coveredByMediCal: true, fdaClass: 'Original FDA', wicClass: 'Original WIC', st: 'S', infantToddler: 'Infant' });
    const edited = updateProduct(original.id, { ...original, formulaDescription: 'Updated description', flavor: 'Chocolate', packaging: 'Carton', manufacturer: 'New maker', mcKessonPo: 'PO-002', mcKessonPrice: 30, coveredByMediCal: false, fdaClass: 'Updated FDA', wicClass: 'Updated WIC', st: 'T', infantToddler: 'Toddler' });
    expect(edited).toMatchObject({ formulaDescription: 'Updated description', flavor: 'Chocolate', packaging: 'Carton', manufacturer: 'New maker', mcKessonPo: 'PO-002', mcKessonPrice: 30, coveredByMediCal: false, fdaClass: 'Updated FDA', wicClass: 'Updated WIC', st: 'T', infantToddler: 'Toddler' });
    const cleared = updateProduct(original.id, { ...edited, formulaDescription: '', packaging: '', yield: null, mcKessonPrice: null, coveredByMediCal: null });
    expect(cleared.formulaDescription).toBeUndefined();
    expect(cleared.packaging).toBeUndefined();
    expect(cleared.yield).toBeUndefined();
    expect(cleared.mcKessonPrice).toBeUndefined();
    expect(cleared.coveredByMediCal).toBeUndefined();
});
