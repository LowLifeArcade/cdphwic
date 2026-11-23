import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('product catalog actions', () => {
    it('links to separate manual and bulk product workflows', () => {
        const catalog = readFileSync(new URL('../app/pages/products/index.vue', import.meta.url), 'utf8');
        const bulkPage = readFileSync(new URL('../app/pages/products/bulk-upload.vue', import.meta.url), 'utf8');

        expect(catalog).toContain('to="/products/new"');
        expect(catalog).toContain('to="/products/bulk-upload"');
        expect(catalog).toContain('Edit product');
        expect(bulkPage).toContain('Formula Description,Manufacturer,Formula Name,Formula Form,Flavor,Packaging,Product Number');
        expect(bulkPage).toContain("'/api/products/bulk'");
    });

    it('supports the spreadsheet table, filters, and Medi-Cal tags', () => {
        const catalog = readFileSync(new URL('../app/pages/products/index.vue', import.meta.url), 'utf8');

        expect(catalog).toContain('class="product-catalog-table"');
        expect(catalog).not.toContain('products-view-mode');
        expect(catalog).not.toContain('categoryFilter');
        expect(catalog).toContain('mcKessonPoFilter');
        expect(catalog).toContain('wicCategoryFilter');
        expect(catalog).toContain('class="coverage-tag"');
        expect(catalog).toContain('class="product-list"');
    });
});
