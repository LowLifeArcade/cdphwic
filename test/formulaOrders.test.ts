import {it,expect} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {formulaOrders,allFormulasSpecialOrder,hasSpecialOrder,validateFormulaOrders,hasFormulaAwaitingEta} from '../shared/formulaOrders';
import {filterAndSortRequests} from '../shared/requestListFilters';
const base={id:1,status:'in_progress',approved:true,participantName:'Test',requestedFormulas:[{productName:'First',productForm:'powder',ouncesPrescribed:10},{productName:'Second',productForm:'ready-to-feed',flavor:'Vanilla',ouncesPrescribed:20}]} as RequestRecord;
it('keeps legacy special orders and matches explicit orders by name, form and flavor',()=>{
 expect(formulaOrders({...base,specialOrder:true}).map(f=>f.specialOrder)).toEqual([true,true]);
 const rows=formulaOrders(base);rows[1]!.specialOrder=true;
 const mixed={...base,formulaOrders:rows,specialOrder:true};
 expect(allFormulasSpecialOrder(mixed)).toBe(false);expect(hasSpecialOrder(mixed)).toBe(true);
 expect(formulaOrders({...mixed,requestedFormulas:[...base.requestedFormulas!].reverse()}).map(f=>f.specialOrder)).toEqual([true,false]);
 expect(formulaOrders({...mixed,requestedFormulas:[{...base.requestedFormulas![1]!,flavor:'Chocolate'}]})[0]!.specialOrder).toBe(false);
 expect(allFormulasSpecialOrder({...base,formulaOrders:rows.map(f=>({...f,specialOrder:true}))})).toBe(true);
});
it('includes mixed requests in the Special Order filter',()=>{
 const rows=formulaOrders(base);rows[1]!.specialOrder=true;
 expect(filterAndSortRequests([{...base,formulaOrders:rows,specialOrder:false}],'all','special','submitted')).toHaveLength(1);
});
it('validates complete, unique, boolean order selections for the requested formulas',()=>{
 const rows=formulaOrders(base);
 expect(validateFormulaOrders(base,rows)).toBe('');
 expect(validateFormulaOrders(base,[rows[0]!])).toBeTruthy();
 expect(validateFormulaOrders(base,[rows[0]!,rows[0]!])).toBeTruthy();
 expect(validateFormulaOrders(base,[rows[0]!,{...rows[1]!,specialOrder:'yes'}] as never)).toBeTruthy();
 expect(validateFormulaOrders(base,null as never)).toBeTruthy();
});
it('waits for ETA only for standard formulas and associates published shipments with the right formula',()=>{
 const rows=formulaOrders(base);rows[1]!.specialOrder=true;
 const mixed={...base,formulaOrders:rows};
 expect(hasFormulaAwaitingEta(mixed,true)).toBe(true);
 const sent={...mixed,shipments:[{eta:'2026-11-10',etaSentAt:'2026-11-03T12:00:00Z',casesShipped:2,carrier:'ups',trackingNumbers:['A'],shipmentFormula:rows[0]}]} as RequestRecord;
 expect(hasFormulaAwaitingEta(sent,true)).toBe(false);expect(hasFormulaAwaitingEta(sent)).toBe(true);
 expect(hasFormulaAwaitingEta({...mixed,formulaOrders:rows.map(f=>({...f,specialOrder:true}))},true)).toBe(false);
});
