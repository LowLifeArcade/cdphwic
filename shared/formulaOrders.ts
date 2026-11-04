import type {RequestRecord} from './domain';
import {shipmentFormulaKey,shipmentFormulaOptions,resolveShipmentFormula,type ShipmentFormula} from './shipmentFormulas';
import {requestShipments} from './requestShipments';
import {shipmentDispatched} from './shipmentReceipts';

export interface FormulaOrder extends ShipmentFormula {specialOrder:boolean}
export function formulaOrders(request:Partial<RequestRecord>):FormulaOrder[]{
    return shipmentFormulaOptions(request).map(formula=>({
        ...formula,
        specialOrder:request.formulaOrders?.length
            ? request.formulaOrders.find(row=>shipmentFormulaKey(row)===shipmentFormulaKey(formula))?.specialOrder===true
            : request.specialOrder===true,
    }));
}
export function allFormulasSpecialOrder(request:Partial<RequestRecord>):boolean {
    const rows=formulaOrders(request);
    return rows.length>0 && rows.every(row=>row.specialOrder);
}
export function hasSpecialOrder(request:Partial<RequestRecord>):boolean {return formulaOrders(request).some(row=>row.specialOrder);}
export function validateFormulaOrders(request:Partial<RequestRecord>,rows:FormulaOrder[]):string {
    const expected=shipmentFormulaOptions(request).map(shipmentFormulaKey);
    if(!Array.isArray(rows)||rows.length!==expected.length)return 'Select an order type for each requested formula.';
    const keys=new Set<string>();
    for(const row of rows){
        if(!row || typeof row.productName!=='string' || typeof row.specialOrder!=='boolean' || (row.flavor!==undefined&&typeof row.flavor!=='string'))return 'Select a valid formula order type.';
        const key=shipmentFormulaKey(row);
        if(!expected.includes(key)||keys.has(key))return 'Order types must match each requested formula exactly once.';
        keys.add(key);
    }
    return '';
}
// Unsent special orders do not create an ETA-pending message for the standard formula.
export function hasFormulaAwaitingEta(request:Partial<RequestRecord>,standardOnly=false):boolean {
    const published=requestShipments(request).filter(row=>shipmentDispatched(request,row));
    return formulaOrders(request).some(formula=>(!standardOnly||!formula.specialOrder)
        && !published.some(row=>shipmentFormulaKey(resolveShipmentFormula(request,row))===shipmentFormulaKey(formula)));
}
