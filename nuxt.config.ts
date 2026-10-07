// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2026-10-07',
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    nitro: {
        preset: 'cloudflare_module',
        experimental: {
            database: true,
        },
        devDatabase: {
            default: {
                connector: 'cloudflare-d1',
                options: { bindingName: 'CDPHWIC' },
            },
        },
        database: {
            default: {
                connector: 'cloudflare-d1',
                options: { bindingName: 'CDPHWIC' },
            },
        },
        cloudflare: {
            deployConfig: false,
            nodeCompat: true,
        },
        typescript: {
            tsConfig: {
                compilerOptions: {
                    types: ['@cloudflare/workers-types'],
                },
            },
        },
    },
    modules: ['nitro-cloudflare-dev'],
});
