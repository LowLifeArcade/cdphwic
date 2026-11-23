import type {ProductRecord,RequestRecord} from './domain';
import {isMcKessonPo} from './mckessonPo';
import {formulaOrders} from './formulaOrders';

export function applyCatalogOrderDefault(request:Partial<RequestRecord>,index:number,product:ProductRecord):Pick<RequestRecord,'formulaOrders'|'formulaAuthorizations'> {
    const orders=formulaOrders(request);
    const special=!isMcKessonPo(product.mcKessonPo);
    if(orders[index])orders[index]!.specialOrder=special;
    const authorizations=request.formulaAuthorizations?.map((row,rowIndex)=>rowIndex!==index?row:{...row,
        standardCases:row.approvedCases===undefined?undefined:special?0:row.approvedCases,
        specialOrderCases:row.approvedCases===undefined?undefined:special?row.approvedCases:0,
    });
    return {formulaOrders:orders,formulaAuthorizations:authorizations};
}
export function catalogPoCasesRemaining(product?:ProductRecord):number|undefined {
    if(!product)return undefined;
    if(Number.isFinite(product.casesRemaining))return product.casesRemaining;
    if(Number.isFinite(product.casesApproved)&&Number.isFinite(product.casesUsed))return product.casesApproved!-product.casesUsed!;
    return undefined;
}
