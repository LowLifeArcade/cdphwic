import { defineNitroPlugin } from 'nitropack/runtime';
import { refreshSurplusNotices } from '../utils/surplusNotices';
export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook('cloudflare:scheduled', async ({ env }) => {
        await refreshSurplusNotices((env as Env).CDPHWIC);
    });
});
