import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import * as Vue from 'vue';
import {renderToString} from '@vue/server-renderer';
import {compileScript,parse} from '@vue/compiler-sfc';
import {transformWithEsbuild} from 'vite';
import {candidateProducts} from '../shared/productMatching';
import type {ProductRecord} from '../shared/domain';
it('renders exact Kate Farms descriptions and product numbers from a submitted formula name',async()=>{
    const rows=[{id:1,name:'Kate Farms Pediatric Std 1.2',productCode:'851823006997',form:'ready-to-feed',flavor:'Vanilla',formulaDescription:'Kate Farms Pediatric Standard 1.2, 8.45 fl oz RTF, Vanilla'}, {id:2,name:'Kate Farms Pediatric Std 1.2',productCode:'811112030713',form:'ready-to-feed',flavor:'Chocolate',formulaDescription:'Kate Farms Pediatric Standard 1.2, 8.45 fl oz RTF, Chocolate'}] as ProductRecord[];
    const {descriptor}=parse(readFileSync(new URL('../app/components/ProductVariantSelect.vue',import.meta.url),'utf8'));
    const compiled=compileScript(descriptor,{id:'candidate-ui',inlineTemplate:true});
    const {code}=await transformWithEsbuild(compiled.content,'candidate.ts',{loader:'ts',format:'cjs'});
    const module={exports:{} as {default:Vue.Component}};
    new Function('require','module','exports',code)((name:string)=>{if(name==='vue')return Vue;throw Error(name);},module,module.exports);
    const html=await renderToString(Vue.createSSRApp(module.exports.default,{identity:'internal',products:candidateProducts(rows,{name:'Kate Farms Pediatric Std 1.2 Cal',form:'ready-to-feed'})}));
    for(const row of rows){expect(html).toContain(row.formulaDescription);expect(html).toContain(`value="${row.productCode}"`);}
});
