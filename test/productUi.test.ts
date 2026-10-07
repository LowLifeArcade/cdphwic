import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('product catalog actions', () => {
    it('links to separate manual and bulk product workflows', () => {
        const catalog = readFileSync(new URL('../app/pages/products/index.vue', import.meta.url), 'utf8');
        const bulkPage = readFileSync(new URL('../app/pages/products/bulk-upload.vue', import.meta.url), 'utf8');

        expect(catalog).toContain('to="/products/new"');
        expect(catalog).toContain('to="/products/bulk-upload"');
        expect(catalog).toContain('Edit product');
        expect(catalog).toContain('aria-label="Product actions"');
        expect(bulkPage).toContain('productId,productCode,name,form');
        expect(bulkPage).toContain("'/api/products/bulk'");
    });

    it('supports catalog views, filters, and coverage tags', () => {
        const catalog = readFileSync(new URL('../app/pages/products/index.vue', import.meta.url), 'utf8');

        expect(catalog).toContain("ref<'grid' | 'list'>('grid')");
        expect(catalog).toContain('categoryFilter');
        expect(catalog).toContain('coverageFilter');
        expect(catalog).toContain('class="coverage-tag"');
        expect(catalog).toContain('class="product-list"');
    });
});
