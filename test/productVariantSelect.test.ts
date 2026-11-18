import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse, compileScript } from '@vue/compiler-sfc';
import { buildSync } from 'esbuild';
import { dirname } from 'node:path';
import { computed } from 'vue';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { expect, it } from 'vitest';

function loadSelector(path = '../app/components/ProductVariantSelect.vue') {
    const filename = new URL(path, import.meta.url);
    const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname });
    const script = compileScript(descriptor, { id: 'variant-test', inlineTemplate: true });
    const code = buildSync({ stdin: { contents: script.content.replaceAll('~/../', '../../'), resolveDir: dirname(filename.pathname), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'] }).outputFiles[0]!.text;
    const module = { exports: {} as { default?: unknown } };
    new Function('require', 'module', 'exports', 'computed', code)(createRequire(import.meta.url), module, module.exports, computed);
    return module.exports.default as Parameters<typeof createSSRApp>[0];
}
const product = { id: 1, name: 'Short name', productCode: '001', formulaDescription: 'Long detailed description', packaging: '8 oz carton', flavor: 'Vanilla', form: 'ready-to-feed' };
it.each(['admin', 'internal'])('shows product descriptions, packaging and numbers to %s', async (identity) => {
    const html = await renderToString(createSSRApp(loadSelector(), { identity, products: [product], modelValue: '001' }));
    expect(html).toContain('Long detailed description');
    expect(html).toContain('8 oz carton');
    expect(html).toContain('001');
    expect(html).toContain('value="001"');
});
it('does not expose the technical product selector to local agencies', async () => {
    const html = await renderToString(createSSRApp(loadSelector(), { identity: 'agency', products: [product], modelValue: '' }));
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Long detailed description');
});

it('does not show an arbitrary catalog product in the agency issuance summary', async () => {
    const products = [{ ...product, form: 'powder', unitsPerCase: 6, yield: 8 }, { ...product, productCode: '002', form: 'powder', unitsPerCase: 12, yield: 16 }];
    const html = await renderToString(createSSRApp(loadSelector('../app/components/RequestIssuanceSummary.vue'), { request: { productName: 'Short name', productForm: 'powder', formulaAuthorizations: [{ productName: 'Short name', productForm: 'powder', benefitIssuances: [] }] }, products }));
    expect(html).not.toContain('<strong>001</strong>');
    expect(html).not.toContain('<strong>6</strong>');
    expect(html).not.toContain('8 fl oz');
});
it('honors explicitly cleared products in the agency issuance summary', async () => {
    const html = await renderToString(createSSRApp(loadSelector('../app/components/RequestIssuanceSummary.vue'), { request: { productName: 'Short name', productForm: 'powder', formulaAuthorizations: [{ productName: 'Short name', productForm: 'powder', productCode: '', benefitIssuances: [] }] }, products: [{ ...product, form: 'powder', unitsPerCase: 6, yield: 8 }] }));
    expect(html).not.toContain('<strong>001</strong>');
    expect(html).not.toContain('<strong>6</strong>');
});
