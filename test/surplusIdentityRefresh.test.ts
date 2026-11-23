import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

const page=readFileSync(new URL('../app/pages/surplus.vue',import.meta.url),'utf8');

it('refreshes agency-scoped surplus when the selected login changes',()=>{
 expect(page).toContain("const { data, refresh, error } = await useFetch('/api/surplus', { headers, server: false, watch: [identity] });");
});
