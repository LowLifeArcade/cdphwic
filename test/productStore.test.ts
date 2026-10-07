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
