import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {transformWithEsbuild} from 'vite';
import type {ProductRecord,RequestRecord} from '../shared/domain';
import {authorizationCatalogProduct,selectAuthorizationProduct,enterAuthorizationProductNumber} from '../shared/productMatching';
import {applyCatalogOrderDefault} from '../shared/catalogOrderDefaults';
import {formulaOrders} from '../shared/formulaOrders';
const source=readFileSync(new URL('../app/components/RequestDetailDrawer.vue',import.meta.url),'utf8');
async function fixture(flag?:string,catalogName='Formula') {
    const products=[{id:1,name:catalogName,form:'powder',productCode:'001',unitsPerCase:6,mcKessonPo:flag}] as ProductRecord[];
    const draft:Partial<RequestRecord>={requestedFormulas:[{productName:'Formula',productForm:'powder',ouncesPrescribed:8}],formulaAuthorizations:[{productName:'Formula',productForm:'powder',unitsToOrder:0,benefitIssuances:[]}]};
    const block=source.slice(source.indexOf('function chooseAuthorizationProduct('),source.indexOf('function authorizationUnitsPerCase('));
    const recalculate=source.match(/function recalculateCasesFromUnitsToOrder[^\n]+/)![0];
    const adjust=source.slice(source.indexOf('function adjustFulfillmentAllocation('),source.indexOf('\n}',source.indexOf('function adjustFulfillmentAllocation('))+2);
    const {code}=await transformWithEsbuild(block+'\n'+recalculate+'\n'+adjust,'selection.ts',{loader:'ts'});
    const productFor=(authorization:any)=>authorizationCatalogProduct(products,authorization);
    const api=new Function('draft','props','selectAuthorizationProduct','enterAuthorizationProductNumber','applyCatalogOrderDefault','formulaOrders','authorizationProduct','authorizationUnitsPerCase',code+'\nreturn {chooseAuthorizationProduct,enterProductNumber,recalculateCasesFromUnitsToOrder};')(draft,{products,request:draft},selectAuthorizationProduct,enterAuthorizationProductNumber,applyCatalogOrderDefault,formulaOrders,productFor,(authorization:any)=>authorization.unitsPerCase??productFor(authorization)?.unitsPerCase);
    return {draft,api};
}
it.each(['chooseAuthorizationProduct','enterProductNumber'])('applies catalog defaults through %s and retains them after quantity entry',async method=>{
    for(const [flag,special] of [['No',true],['Yes',false]] as const){
        const {draft,api}=await fixture(flag);
        api[method](0,'001');
        expect(draft.formulaOrders?.[0]?.specialOrder).toBe(special);
        draft.formulaAuthorizations![0]!.unitsToOrder=12;
        api.recalculateCasesFromUnitsToOrder(0);
        expect(draft.formulaAuthorizations?.[0]).toMatchObject({approvedCases:2,standardCases:special?0:2,specialOrderCases:special?2:0});
    }
});

it('populates a number-only catalog match and applies its Special Order default',async()=>{
    const {draft,api}=await fixture('No','Kate Farms Pediatric Std 1.2 Cal');
    api.enterProductNumber(0,'001');
    expect(draft.formulaAuthorizations?.[0]).toMatchObject({productName:'Formula',formulaName:'Kate Farms Pediatric Std 1.2 Cal',productCode:'001',unitsPerCase:6});
    expect(draft.formulaOrders?.[0]?.specialOrder).toBe(true);
});
