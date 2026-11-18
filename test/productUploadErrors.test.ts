import { expect, it } from 'vitest';
import { productUploadFailure } from '../shared/productUploadErrors';
it('reads structured validation details from the HTTP body instead of the flattened status text', () => {
    const issues = [{ row: 61, column: 'Formula Form', cell: 'B61', value: 'Invalid', message: 'Choose a valid form.' }];
    expect(productUploadFailure({ statusMessage: 'Bad Request', data: { data: { message: 'Upload blocked. No products were added.', issues } } })).toEqual({ message: 'Upload blocked. No products were added.', issues });
});
it('preserves readable legacy errors and generic network failures', () => {
    expect(productUploadFailure({ data: { statusMessage: 'Row 61: Fix form.\nRow 72: Fix form.' } })).toEqual({ message: 'Row 61: Fix form.\nRow 72: Fix form.', issues: [] });
    expect(productUploadFailure(new Error('Failed to fetch')).message).toContain('could not be uploaded');
});

it('renders each issue in a separate accessible table row, with entered values escaped', async () => {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const { parse, compileScript } = await import('@vue/compiler-sfc');
    const { transformSync } = await import('esbuild');
    const { createSSRApp } = await import('vue');
    const { renderToString } = await import('vue/server-renderer');
    const file = new URL('../app/components/ProductUploadErrors.vue', import.meta.url);
    const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file.pathname });
    const script = compileScript(descriptor, { id: 'errors-test', inlineTemplate: true });
    const code = transformSync(script.content, { loader: 'ts', format: 'cjs' }).code;
    const module = { exports: {} as { default: Parameters<typeof createSSRApp>[0] } };
    new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), module, module.exports);
    const html = await renderToString(createSSRApp(module.exports.default, { message: 'No products were added.', issues: [
        { row: 61, column: 'Formula Form', cell: 'B61', value: '<invalid>', formulaName: 'Example', message: 'Choose a supported form or leave blank.' },
        { row: 108, column: 'Units Per Case', cell: 'E108', value: 'six', message: 'Enter a positive number or leave blank.' },
    ] }));
    expect(html).toContain('role="alert"');
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain('B61');
    expect(html).toContain('E108');
    expect(html).toContain('&lt;invalid&gt;');
    expect(html).toContain('six');
});
