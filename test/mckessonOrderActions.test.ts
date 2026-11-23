import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {ref} from 'vue';
import {transformWithEsbuild} from 'vite';
async function actions(fetch=vi.fn().mockRejectedValue(new Error('Connection lost'))){
 const source=readFileSync(new URL('../app/components/McKessonOrderPanel.vue',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('async function place()'),source.indexOf('async function updateOrder('));
 const {code}=await transformWithEsbuild(block,'actions.ts',{loader:'ts'});
 const state={pendingOrder:ref(),canPlace:ref(true),busy:ref(false),error:ref(''),message:ref(''),cases:ref<number|undefined>(5),loadError:ref(),pos:ref<any[]>([])};
 const refresh=vi.fn();
 const api=new Function(...Object.keys(state),'props','productCode','orderDate','poId','headers','$fetch','refresh','emit','failure',code+';return {place,checkPendingOrder};')(...Object.values(state),{request:{id:1}},ref('001'),ref('2027-01-01'),ref(1),ref({'x-demo-user':'admin'}),fetch,refresh,vi.fn(),(e:Error)=>e.message);
 return {state,api,fetch,refresh};
}
it('retries an interrupted order with the same operation ID and payload',async()=>{
 const f=await actions();await f.api.place();const original={...f.state.pendingOrder.value};
 f.fetch.mockResolvedValueOnce({order:original});await f.api.place();
 expect(f.fetch.mock.calls[1][1].body).toEqual(original);expect(f.state.pendingOrder.value).toBeUndefined();expect(f.state.cases.value).toBeUndefined();
});
it('keeps the same operation reference when status has not appeared yet',async()=>{
 const f=await actions();await f.api.place();const original=f.state.pendingOrder.value.id;
 await f.api.checkPendingOrder();expect(f.state.pendingOrder.value?.id).toBe(original);
});
it('reports a successful placement separately from a failed balance refresh',async()=>{
 const f=await actions(vi.fn().mockResolvedValue({}));f.refresh.mockImplementation(async()=>{f.state.loadError.value=new Error('Refresh failed');});
 await f.api.place();expect(f.state.pendingOrder.value).toBeUndefined();expect(f.state.message.value).toContain('Order recorded');expect(f.state.error.value).toContain('could not be refreshed');
});
