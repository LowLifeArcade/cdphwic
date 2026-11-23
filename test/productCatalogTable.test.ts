import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transformWithEsbuild } from 'vite';
import * as editor from '../shared/productEditor';
import * as presentation from '../shared/requestPresentation';
import type { ProductRecord } from '../shared/domain';

const base = { id: 11, productId: 'INTERNAL-11', productCode: '001234', name: 'Formula name', formulaDescription: 'Full formula description', manufacturer: 'Maker', form: 'ready-to-feed', flavor: 'Vanilla', packaging: '8 oz carton', unitsPerCase: 6, yield: 0, coverage: ['wic'], coveredByMediCal: true, mcKessonPo: 'HIDDEN-PO', mcKessonPrice: 42, casesUsed: 99, fdaClass: 'HIDDEN-FDA', wicClass: 'HIDDEN-WIC', st: 'HIDDEN-ST', infantToddler: 'HIDDEN-AGE' } as ProductRecord;
async function renderCatalog(products: ProductRecord[], filters: { search?: string; po?: string | null; category?: string | null } = {}) {
    const source = readFileSync(new URL('../app/pages/products/index.vue', import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    const compiled = compileScript(descriptor, { id: 'catalog-test', inlineTemplate: true });
    const { code } = await transformWithEsbuild(compiled.content, 'catalog.ts', { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { default?: Vue.Component } };
    const require = (name: string) => {
        if (name === 'vue') return Vue;
        if (name === '~/../shared/productEditor') return editor;
        if (name === '~/../shared/requestPresentation') return presentation;
        throw new Error(`Unexpected import ${name}`);
    };
    const initialFilters = [filters.search ?? '', filters.po === undefined ? '' : filters.po, filters.category === undefined ? '' : filters.category];
    let refIndex = 0;
    const ref = (value: unknown) => Vue.ref(refIndex < initialFilters.length ? initialFilters[refIndex++] : value);
    new Function('require', 'module', 'exports', 'useFetch', 'useCookie', 'ref', 'computed', 'onMounted', 'onBeforeUnmount', 'useState', code)(
        require, module, module.exports,
        vi.fn(async () => ({ data: Vue.ref({ products }) })), () => Vue.ref('grid'), ref, Vue.computed, Vue.onMounted, Vue.onBeforeUnmount, () => Vue.ref('agency'),
    );
    const app = Vue.createSSRApp(module.exports.default!);
    app.component('NuxtLink', { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) });
    return renderToString(app);
}
const clean = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').trim();
const cells = (row: string) => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => clean(match[1]));

it('renders matching headers and cells in the requested order, regardless of the old grid cookie', async () => {
    const html = await renderCatalog([base]);
    expect([...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(match => clean(match[1]))).toEqual(['Formula Description', 'Manufacturer', 'Formula Name', 'Form', 'Flavor', 'Packaging', 'Product Number', 'Units Per Case', 'Yield', 'Covered by Medi-Cal', 'Actions']);
    expect(cells(html)).toEqual(['Full formula description', 'Maker', 'Formula name', 'Ready-to-Feed', 'Vanilla', '8 oz carton', '001234', '6', '0', 'Medi-Cal', 'Edit']);
    expect(html).toContain('href="/products/11"');
    expect(clean(/<tbody>([\s\S]*?)<\/tbody>/.exec(html)![1])).not.toMatch(/INTERNAL-11|HIDDEN-PO|HIDDEN-FDA|HIDDEN-WIC|HIDDEN-ST|HIDDEN-AGE|>WIC</);
});
it('only tags covered products and preserves blank cells without shifting columns', async () => {
    const html = await renderCatalog([
        base,
        { ...base, id: 12, coveredByMediCal: false, coverage: ['wic', 'medical'], formulaDescription: '', manufacturer: '', unitsPerCase: undefined, yield: undefined },
        { ...base, id: 13, coveredByMediCal: undefined, coverage: ['medical'] },
        { ...base, id: 14, coveredByMediCal: undefined, coverage: ['wic'] },
    ]);
    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(match => cells(match[1])).filter(row => row.length);
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.length === 11)).toBe(true);
    expect(rows.filter(row => row[9] === 'Medi-Cal')).toHaveLength(2);
    const blankRow = rows.find(row => row[0] === '—')!;
    expect(blankRow.slice(0, 2)).toEqual(['—', '—']);
    expect(blankRow.slice(7, 10)).toEqual(['—', '—', '—']);
    expect(html).not.toContain('<option value="wic">');
    expect(html).not.toContain('Filter by form');
    expect(html).not.toContain('Filter by coverage');
});
it('renders one spanning empty-result cell instead of a malformed row', async () => {
    const html = await renderCatalog([]);
    expect(html).toContain('colspan="11"');
    expect(html).toContain('No products match these filters.');
});

it('replaces the old controls and combines McKesson PO and WIC Category filters with search', async () => {
    const products = [
        { ...base, mcKessonPo: 'Y', wicClass: 'Contract' },
        { ...base, id: 12, mcKessonPo: 'N', wicClass: 'Contract' },
        { ...base, id: 13, mcKessonPo: 'Y', wicClass: 'SNC' },
        { ...base, id: 14, name: 'Unrelated formula', manufacturer: 'Different', mcKessonPo: 'Y', wicClass: 'Contract' },
    ];
    const html = await renderCatalog(products, { search: ' MAKER ', po: 'Y', category: 'Contract' });
    expect(html).toContain('Filter by McKesson PO');
    expect(html).toContain('Filter by WIC Category');
    expect(html).not.toContain('Filter by form');
    expect(html).not.toContain('Filter by coverage');
    expect(html).toContain('href="/products/11"');
    expect(html).not.toMatch(/href="\/products\/(12|13|14)"/);
    expect(cells(html)).toHaveLength(11);
    const all = await renderCatalog(products);
    expect(cells(all)).toHaveLength(44);
});
it('offers only set WIC categories, existing PO values and explicit blank filters', async () => {
    const products = [base, { ...base, id: 12, mcKessonPo: '', wicClass: undefined }, { ...base, id: 13, mcKessonPo: 'Y', wicClass: 'SNC' }];
    const html = await renderCatalog(products);
    for (const value of ['Exempt', 'Nutritional', 'Contract', 'SNC', 'HIDDEN-PO', 'Y']) expect(html).toContain(`>${value}</option>`);
    expect(html).toContain('McKesson PO');
    expect(html).toContain('All WIC categories');
    expect(html).not.toContain('>HIDDEN-WIC</option>');
    const blank = await renderCatalog(products, { po: null, category: null });
    expect(blank).toContain('href="/products/12"');
    expect(cells(blank)).toHaveLength(11);
});
it('keeps filtered products in natural alphabetical formula order', async () => {
    const html = await renderCatalog([{ ...base, id: 12, name: 'Formula 10' }, { ...base, id: 13, name: 'Formula 2' }, { ...base, name: 'Alpha' }]);
    const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(match => cells(match[1])).filter(row => row.length);
    expect(rows.map(row => row[2])).toEqual(['Alpha', 'Formula 2', 'Formula 10']);
});

it('retains searching by supplier reference even though the field is hidden', async () => {
    const html = await renderCatalog([{ ...base, supplierReference: 'Supplier-lookup-777' }], { search: 'lookup-777' });
    expect(cells(html)).toHaveLength(11);
    expect(html).toContain('href="/products/11"');
    expect(html).not.toContain('Supplier-lookup-777');
});
