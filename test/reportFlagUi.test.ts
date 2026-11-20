import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transformWithEsbuild } from 'vite';
import { reportFeatureFlags } from '../shared/featureFlags';

it.each([false, true])('renders and requests the McKesson report only when enabled (%s)', async enabled => {
    const source = readFileSync(new URL('../app/pages/reports.vue', import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    const compiled = compileScript(descriptor, { id: 'reports-test', inlineTemplate: true });
    const { code } = await transformWithEsbuild(compiled.content, 'reports.ts', { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { default?: Vue.Component } };
    const fetch = vi.fn(async (_url: string) => ({ data: Vue.ref({ rows: [], months: [] }) }));
    const require = (name: string) => {
        if (name === 'vue') return Vue;
        if (name === '~/../shared/featureFlags') return { reportFeatureFlags };
        throw new Error(`Unexpected import ${name}`);
    };
    new Function('require', 'module', 'exports', 'useFetch', 'useRuntimeConfig', 'computed', 'ref', code)(
        require, module, module.exports, fetch, () => ({ public: { mckessonReport: enabled } }), Vue.computed, Vue.ref,
    );
    const html = await renderToString(Vue.createSSRApp(module.exports.default!));
    expect(html).toContain('Master Log');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(enabled ? ['/api/reports/master-log', '/api/reports/mckesson-log'] : ['/api/reports/master-log']);
    expect(html.includes('<h2>McKesson Log</h2>')).toBe(enabled);
    expect(html.includes('href="/api/reports/mckesson-log.csv"')).toBe(enabled);
    expect(html.includes('href="/api/reports/mckesson-log.xlsx"')).toBe(enabled);
});
