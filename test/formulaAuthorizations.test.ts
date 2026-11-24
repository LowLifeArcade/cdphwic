import {it,expect} from 'vitest';
import {formulaAuthorizations,formatIssuanceMonth,validateFormulaAuthorizations} from '../shared/formulaAuthorizations';
import type {RequestRecord} from '../shared/domain';
const request={productName:'First',productForm:'powder',approvedCases:4,benefitIssuances:[{month:'2026-09',quantity:12}],requestedFormulas:[{productName:'First',productForm:'powder'},{productName:'Second',productForm:'ready-to-feed'}]} as RequestRecord;
it('keeps legacy issuance with the first formula and starts the second separately',()=>{
 const rows=formulaAuthorizations(request);expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({approvedCases:4,benefitIssuances:[{month:'2026-09',quantity:12}]});expect(rows[1]!.approvedCases).toBeUndefined();
});
it('matches saved issuance to formula variants and clones month rows',()=>{
 const rows=formulaAuthorizations(request);rows[1]!.approvedCases=8;
 const saved={...request,formulaAuthorizations:rows,requestedFormulas:[request.requestedFormulas![1]!,request.requestedFormulas![0]!]};
 const next=formulaAuthorizations(saved);expect(next[0]!.approvedCases).toBe(8);next[1]!.benefitIssuances![0]!.quantity=99;expect(rows[0]!.benefitIssuances![0]!.quantity).toBe(12);
});
it('restores the selected catalog flavor when the submitted formula omitted it',()=>{
 const selected={...formulaAuthorizations(request)[0]!,flavor:'Vanilla',formulaName:'Fortini Vanilla'};
 const saved={...request,requestedFormulas:[{productName:'First',productForm:'powder' as const}],formulaAuthorizations:[{...selected,productName:'First'}]};
 expect(formulaAuthorizations(saved)[0]).toMatchObject({flavor:'Vanilla',formulaName:'Fortini Vanilla'});
});
it('formats abbreviated months and validates each formula separately',()=>{
 expect(formatIssuanceMonth('2026-09')).toBe('SEP 2026');const rows=formulaAuthorizations(request);rows[1]!.benefitIssuances=[{month:'2026-09',quantity:2}];expect(validateFormulaAuthorizations(rows)).toEqual([]);rows[1]!.approvedCases=-1;expect(validateFormulaAuthorizations(rows)[0]).toContain('Formula 2');
});

it('starts unsaved formula issuance with an unselected month while preserving saved months',()=>{
 const rows=formulaAuthorizations({...request,benefitIssuances:undefined});
 expect(rows.map(row=>row.benefitIssuances)).toEqual([[{month:'',quantity:0}],[{month:'',quantity:0}]]);
 expect(formulaAuthorizations(request)[0]!.benefitIssuances[0]!.month).toBe('2026-09');
});

it('defaults legacy formula order to a complete standard or special-order allocation',()=>{
 expect(formulaAuthorizations(request)[0]).toMatchObject({standardCases:4,specialOrderCases:0});
 expect(formulaAuthorizations({...request,specialOrder:true})[0]).toMatchObject({standardCases:0,specialOrderCases:4});
});

it('requires standard and special-order cases to equal approved cases',()=>{
 const rows=formulaAuthorizations(request);rows[0]!.standardCases=2;rows[0]!.specialOrderCases=2;
 rows[1]!.benefitIssuances=[{month:'2026-09',quantity:1}];
 expect(validateFormulaAuthorizations(rows)).toEqual([]);
 rows[0]!.specialOrderCases=1;
 expect(validateFormulaAuthorizations(rows).join(' ')).toContain('Standard and Special Order cases must equal Approved Cases');
});
