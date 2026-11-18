import {expect,it} from 'vitest';
import {validateShipmentAllocations,fulfillmentProgress} from '../shared/fulfillmentAllocations';
import type {RequestRecord} from '../shared/domain';

const request={id:88,status:'approved',approved:true,requestedFormulas:[{productName:'Nutramigen',productForm:'ready-to-feed'}],formulaAuthorizations:[{productName:'Nutramigen',productForm:'ready-to-feed',approvedCases:5,standardCases:2,specialOrderCases:3,benefitIssuances:[{month:'2026-11',quantity:30}]}]} as RequestRecord;
const shipment=(casesShipped:number,fulfillmentType:'standard'|'special')=>({shipmentFormula:{productName:'Nutramigen',productForm:'ready-to-feed' as const},fulfillmentType,casesShipped,unitsPerCase:6,eta:'',carrier:'fedex' as const,trackingNumbers:[]});

it('requires an order type and prevents shipments exceeding their allocated formula portion',()=>{
 expect(validateShipmentAllocations(request,[shipment(2,'standard'),shipment(3,'special')])).toBe('');
 expect(validateShipmentAllocations(request,[shipment(3,'standard')])).toContain('exceeds the 2 approved Standard cases');
 expect(validateShipmentAllocations(request,[{...shipment(1,'standard'),fulfillmentType:undefined}])).toContain('Select Standard or Special Order');
});

it('keeps unsent special-order cases visible after the standard portion ships',()=>{
 const progress=fulfillmentProgress({...request,shipments:[{...shipment(2,'standard'),etaSentAt:'2026-11-10',eta:'2026-11-12'}]});
 expect(progress).toEqual([{formula:'Nutramigen RTF',standard:{allocated:2,shipped:2,received:0,pending:0},special:{allocated:3,shipped:0,received:0,pending:3}}]);
});

it('enforces allocations and per-portion shipment limits on the server',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();
 const previous=await ensureSubmittedRequest(db,{id:9088,submissionId:'fulfillment-limits',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Nutramigen',productForm:'ready-to-feed',requestedFormulas:request.requestedFormulas,status:'approved',approved:true});
 const allocation=request.formulaAuthorizations!;
 await expect(updateSubmittedRequest(db,previous,{formulaAuthorizations:[{...allocation[0]!,standardCases:2,specialOrderCases:2}]})).rejects.toMatchObject({statusCode:400});
 await expect(updateSubmittedRequest(db,previous,{formulaAuthorizations:allocation,shipmentDrafts:[shipment(3,'standard')]})).rejects.toMatchObject({statusCode:400});
});
