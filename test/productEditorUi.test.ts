import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { createProductEditor, productEditorFields, productEditorOptions, productEditorOptionLabel } from '../shared/productEditor';
import { parseProductWorkbook } from '../server/utils/productImport';
import * as XLSX from 'xlsx';

it('renders the formula controls in the requested order without legacy inputs', async () => {
    const source = readFileSync(new URL('../app/pages/products/[id].vue', import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    const result = compileTemplate({ source: descriptor.template!.content, filename: 'product-editor.vue', id: 'test', compilerOptions: { mode: 'function' } });
    expect(result.errors).toEqual([]);
    const render = new Function('Vue', result.code)(Vue);
    const app = Vue.createSSRApp({ render, setup: () => ({
        error: '', product: {}, saving: false, identity: 'admin', showDeleteConfirmation: false,
        form: createProductEditor(), productEditorFields, productEditorOptions, productEditorOptionLabel,
        saveProduct() {}, deleteProduct() {}, cancelDelete() {},
    }) });
    app.component('NuxtLink', { render: () => Vue.h('a') });
    const html = await renderToString(app);
    expect([...html.matchAll(/<label[^>]*>(.*?)<\/label>/g)].map(match => match[1].replace(/<!--[\s\S]*?-->/g, '').replace(' (fl oz)', ''))).toEqual(productEditorFields.map(field => field.label));
    expect(html).not.toMatch(/Unit price|PO price|Cases approved|Cases used|Supplier reference|Product ID|<legend>Coverage/);
    expect((html.match(/<select/g) ?? [])).toHaveLength(6);
});

it('publishes an aligned upload example in editor order that imports successfully', () => {
    const page = readFileSync(new URL('../app/pages/products/bulk-upload.vue', import.meta.url), 'utf8');
    const header = />(Formula Description,[^<]+)<\/code/.exec(page)![1];
    const example = /<code>(Example Formula[^<]+)<\/code/.exec(page)![1];
    expect(header.split(',')).toEqual(productEditorFields.map(field => field.key === 'form' ? 'Formula Form' : field.label));
    expect(example.split(',')).toHaveLength(header.split(',').length);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header.split(','), example.split(',')]), 'Products');
    expect(parseProductWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))[0]).toMatchObject({ manufacturer: 'Example Manufacturer', productCode: '00166806', fdaClass: 'Exempt', wicClass: 'Contract', st: 'Standard', infantToddler: 'Infant' });
});
