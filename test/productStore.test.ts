import { describe, expect, it } from 'vitest';
import { createProduct, updateProduct, updateProducts, validateProductInput } from '../server/utils/productStore';

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
    const { createProducts, listProducts } = await import('../server/utils/productStore');
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
