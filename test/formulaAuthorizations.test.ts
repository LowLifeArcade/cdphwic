import {it,expect} from 'vitest';
import {formulaAuthorizations,formatIssuanceMonth,validateFormulaAuthorizations} from '../shared/formulaAuthorizations';
import type {RequestRecord} from '../shared/domain';
const request={productName:'First',productForm:'powder',approvedCases:4,benefitIssuances:[{month:'2026-09',quantity:12}],requestedFormulas:[{productName:'First',productForm:'powder'},{productName:'Second',productForm:'ready-to-feed'}]} as RequestRecord;
it('keeps legacy issuance with the first formula and starts the second separately',()=>{
 const rows=formulaAuthorizations(request,'2026-09');expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({approvedCases:4,benefitIssuances:[{month:'2026-09',quantity:12}]});expect(rows[1]!.approvedCases).toBeUndefined();
});
it('matches saved issuance to formula variants and clones month rows',()=>{
 const rows=formulaAuthorizations(request,'2026-09');rows[1]!.approvedCases=8;
 const saved={...request,formulaAuthorizations:rows,requestedFormulas:[request.requestedFormulas![1]!,request.requestedFormulas![0]!]};
 const next=formulaAuthorizations(saved,'2026-09');expect(next[0]!.approvedCases).toBe(8);next[1]!.benefitIssuances![0]!.quantity=99;expect(rows[0]!.benefitIssuances![0]!.quantity).toBe(12);
});
it('formats abbreviated months and validates each formula separately',()=>{
 expect(formatIssuanceMonth('2026-09')).toBe('SEP 2026');const rows=formulaAuthorizations(request,'2026-09');rows[1]!.benefitIssuances=[{month:'2026-09',quantity:2}];expect(validateFormulaAuthorizations(rows)).toEqual([]);rows[1]!.approvedCases=-1;expect(validateFormulaAuthorizations(rows)[0]).toContain('Formula 2');
});
