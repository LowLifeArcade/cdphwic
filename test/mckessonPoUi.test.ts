import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import * as Vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {compileScript,parse} from '@vue/compiler-sfc';
import {transformWithEsbuild} from 'vite';
import * as matching from '../shared/productMatching';
import * as po from '../shared/mckessonPo';
import * as editor from '../shared/productEditor';
const current={id:1,number:'PO-NEW',startDate:'2020-01-01',endDate:'2099-12-31',allocations:[{productCode:'00123',productName:'Kate Farms Pediatric Std 1.2',formulaDescription:'Kate Farms Standard 1.2 Vanilla',casesApproved:500,casesAlreadyUsed:20,casesUsed:30,casesRemaining:470}],orders:[{id:'order-1',poId:1,requestId:7,productCode:'00123',cases:10,orderDate:'2026-11-01',status:'placed',version:1}]};
async function render(path:string,identity='admin',props={},pos=[current]){
 const {descriptor}=parse(readFileSync(new URL(path,import.meta.url),'utf8'));
 const compiled=compileScript(descriptor,{id:'po-ui',inlineTemplate:true});
 const {code}=await transformWithEsbuild(compiled.content,'po-ui.ts',{loader:'ts',format:'cjs'});
 const module={exports:{} as {default:Vue.Component}};
 const require=(name:string)=>{if(name==='vue')return Vue;if(name.endsWith('productMatching'))return matching;if(name.endsWith('mckessonPo'))return po;if(name.endsWith('productEditor'))return editor;throw Error(name);};
 new Function('require','module','exports','useState','useFetch','useRoute','ref','computed','watch','reactive',code)(require,module,module.exports,()=>Vue.ref(identity),vi.fn(async()=>({data:Vue.ref({pos,products:[]}),error:Vue.ref(),refresh:vi.fn()})),()=>({query:{upload:'1'}}),Vue.ref,Vue.computed,Vue.watch,Vue.reactive);
 const app=Vue.createSSRApp(module.exports.default,props);
 app.component('NuxtLink',{props:['to'],setup:(props,{slots})=>()=>Vue.h('a',{href:props.to},slots.default?.())});
 return renderToString(app);
}
it('shows upload preview entry, required opening usage instructions, and preserved PO history',async()=>{
 const html=await render('../app/pages/products/pos.vue');
 expect(html).toContain('Effective start date');expect(html).toContain('Effective end date');expect(html).toContain('Preview allocations');expect(html).toContain('Cases Already Used');expect(html).toContain('00123');expect(html).toContain('470');expect(html).toContain('order history');expect(html).toContain('2026-11-01');
});
it('hides PO management for local agency users',async()=>{
 const html=await render('../app/pages/products/pos.vue','agency');expect(html).toContain('Only CDPH/WIC and Admin');expect(html).not.toContain('Preview allocations');
});
it('shows every eligible product flavor and current balance before recording an order',async()=>{
 const products=[{id:1,productCode:'00123',name:'Kate Farms Pediatric Std 1.2',form:'ready-to-feed',flavor:'Vanilla',mcKessonPo:'Y'}];
 const html=await render('../app/components/McKessonOrderPanel.vue','admin',{request:{id:7,productName:'Kate Farms Pediatric Std 1.2 Cal',productForm:'ready-to-feed',formulaFlavor:'Vanilla'},products});
 expect(html).toContain('00123');expect(html).toContain('470');expect(html).toContain('PO-NEW');expect(html).toContain('Record order placed');expect(html).toContain('does not send an order');expect(html).toContain('Save quantity');expect(html).toContain('Cancel order');
});
it('shows Products PO actions and balances with a named current purchasing period',async()=>{
 const html=await render('../app/pages/products/index.vue');expect(html).toContain('Upload New McKesson PO');expect(html).toContain('Manage POs');expect(html).toContain('PO-NEW');expect(html).toContain('PO Remaining');
});
it('does not combine balances of overlapping purchase orders',async()=>{
 const html=await render('../app/pages/products/index.vue','admin',{},[current,{...current,id:2,number:'OVERLAP'}]);expect(html).toContain('Multiple POs cover today');expect(html).not.toContain('Current McKesson PO:');
});
