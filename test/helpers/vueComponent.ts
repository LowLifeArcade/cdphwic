import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import { transformWithEsbuild } from 'vite';
import * as Vue from 'vue';

/** Compile a specific real SFC with explicit dependencies; no Nuxt app or browser needed. */
export async function loadComponent(url: URL, dependencies: Record<string, unknown> = {}): Promise<Vue.Component> {
    const { descriptor, errors } = parse(readFileSync(url, 'utf8'));
    if (errors.length) throw new Error(String(errors));
    const compiled = compileScript(descriptor, { id: url.pathname, inlineTemplate: true });
    const { code } = await transformWithEsbuild(compiled.content, url.pathname + '.ts', { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { default: Vue.Component } };
    new Function('require', 'module', 'exports', code)((name: string) => {
        if (name === 'vue') return Vue;
        if (name in dependencies) return dependencies[name];
        throw new Error(`Unprovided SFC dependency: ${name}`);
    }, module, module.exports);
    return module.exports.default;
}
