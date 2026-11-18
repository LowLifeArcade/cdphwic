import {expect,it} from 'vitest';
import {compactShipmentSummary} from '../shared/shipmentSummary';

const request={status:'in_progress' as const,requestedFormulas:[{productName:'Nutramigen',productForm:'RTF' as const}]};

it('summarizes an unshipped shipment with its formula and quantity',()=>{
 const result=compactShipmentSummary(request,{shipmentFormula:{productName:'Nutramigen',productForm:'RTF'},casesShipped:3,unitsPerCase:6,eta:'',carrier:'fedex',trackingNumbers:[]});
 expect(result).toEqual({formula:'Nutramigen RTF',quantity:'3 cases',status:'Awaiting shipment'});
});

it('shows dispatched shipment ETA and received quantities',()=>{
 const result=compactShipmentSummary(request,{shipmentFormula:{productName:'Nutramigen',productForm:'RTF'},casesShipped:3,unitsPerCase:6,receivedCases:1,eta:'2026-11-20',etaSentAt:'2026-11-13',carrier:'fedex',trackingNumbers:['abc']});
 expect(result).toEqual({formula:'Nutramigen RTF',quantity:'3 cases',status:'Partially received · 1 case of 3 cases'});
});

it('marks completed shipments as received and unresolved discrepancies as issues',()=>{
 const row={shipmentFormula:{productName:'Nutramigen',productForm:'RTF'},casesShipped:3,unitsPerCase:6,receivedCases:3,receivedAt:'2026-11-13',receiptConfirmed:true,eta:'2026-11-20',etaSentAt:'2026-11-13',carrier:'fedex' as const,trackingNumbers:[]};
 expect(compactShipmentSummary(request,row).status).toBe('Received');
 expect(compactShipmentSummary(request,{...row,issue:{type:'incomplete',notes:'Missing cases',reportedAt:'2026-11-13',reportedBy:2}}).status).toBe('Shipment issue');
});
