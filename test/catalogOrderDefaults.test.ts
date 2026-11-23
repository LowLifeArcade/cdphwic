import {expect,it} from 'vitest';
import type {ProductRecord,RequestRecord} from '../shared/domain';
import {applyCatalogOrderDefault,catalogPoCasesRemaining} from '../shared/catalogOrderDefaults';
const product=(mcKessonPo?:string)=>({mcKessonPo}) as ProductRecord;
const request=():Partial<RequestRecord>=>({requestedFormulas:[{productName:'First',productForm:'powder',ouncesPrescribed:8},{productName:'Second',productForm:'powder',ouncesPrescribed:8}],formulaOrders:[{productName:'First',productForm:'powder',specialOrder:false},{productName:'Second',productForm:'powder',specialOrder:false}],formulaAuthorizations:[{productName:'First',productForm:'powder',approvedCases:4,benefitIssuances:[]},{productName:'Second',productForm:'powder',approvedCases:2,benefitIssuances:[]}]});
it.each([undefined,'','No','PO-123'])('defaults non-Yes McKesson PO products to special (%s)',flag=>{
    const state=request();const updated=applyCatalogOrderDefault(state,0,product(flag));
    expect(updated.formulaOrders?.map(row=>row.specialOrder)).toEqual([true,false]);
    expect(updated.formulaAuthorizations?.[0]).toMatchObject({standardCases:0,specialOrderCases:4});
    expect(state.formulaOrders?.[0]?.specialOrder).toBe(false);
});
it.each(['Yes','YES',' yes ','Y',' y '])('defaults Yes products to standard (%s)',flag=>{
    expect(applyCatalogOrderDefault(request(),0,product(flag)).formulaAuthorizations?.[0]).toMatchObject({standardCases:4,specialOrderCases:0});
});
it('retains a special default before quantities have been entered',()=>{
    const state=request();state.formulaAuthorizations![0]!.approvedCases=undefined;
    const result=applyCatalogOrderDefault(state,0,product());
    expect(result.formulaOrders?.[0]?.specialOrder).toBe(true);
    expect(result.formulaAuthorizations?.[0]?.specialOrderCases).toBeUndefined();
});
it('reports available PO cases without treating missing counts as zero',()=>{
    expect(catalogPoCasesRemaining({...product(),casesRemaining:0})).toBe(0);
    expect(catalogPoCasesRemaining({...product(),casesRemaining:17})).toBe(17);
    expect(catalogPoCasesRemaining({...product(),casesApproved:20,casesUsed:3})).toBe(17);
    expect(catalogPoCasesRemaining({...product(),casesApproved:20})).toBeUndefined();
    expect(catalogPoCasesRemaining(undefined)).toBeUndefined();
});
