import {it,expect} from 'vitest';
import {shipmentFormulaOptions,resolveShipmentFormula,shipmentFormulaKey,requireShipmentFormula} from '../shared/shipmentFormulas';
import type {RequestRecord} from '../shared/domain';
const request={productName:'First',productForm:'powder',requestedFormulas:[{productName:'First',productForm:'powder'},{productName:'Second',productForm:'ready-to-feed',flavor:'Vanilla'}]} as RequestRecord;
it('requires a formula choice for two formulas and preserves its form and flavor',()=>{
 const choices=shipmentFormulaOptions(request);expect(resolveShipmentFormula(request,{})).toBeUndefined();
 expect(()=>requireShipmentFormula(request,{})).toThrow('Select the formula');
 expect(resolveShipmentFormula(request,{shipmentFormula:choices[1]})).toMatchObject({productName:'Second',productForm:'ready-to-feed',flavor:'Vanilla'});
 expect(()=>requireShipmentFormula(request,{shipmentFormula:{productName:'Outside',productForm:'powder'}})).toThrow();
});
it('automatically chooses a single formula and infers a transfer from its stock variant',()=>{
 expect(resolveShipmentFormula({productName:'First',productForm:'powder'},{})).toMatchObject({productName:'First'});
 expect(resolveShipmentFormula(request,{transferFormulaName:'Second',transferForm:'ready-to-feed',transferFlavor:'Vanilla'})).toMatchObject({productName:'Second',flavor:'Vanilla'});
 expect(shipmentFormulaKey(shipmentFormulaOptions(request)[0])).not.toBe(shipmentFormulaKey(shipmentFormulaOptions(request)[1]));
});
it('persists the chosen formula when sending ETA and prevents retargeting sent shipments',async()=>{
 const {surplusDb}=await import('./helpers/surplusDb');
 const {ensureSubmittedRequest,updateSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();
 const previous=await ensureSubmittedRequest(db,{...request,id:9966,submissionId:'shipment-formula',agencyId:10,agencyMemberId:100,participantName:'Example',status:'in_progress'});
 const row={eta:'2026-11-01',carrier:'ups' as const,casesShipped:1,trackingNumbers:['FORMULA-2']};
 await expect(updateSubmittedRequest(db,previous,{shipments:[row]},false,0,200,undefined,false)).rejects.toThrow('Select the formula');
 const selected=shipmentFormulaOptions(previous)[1]!;
 const saved=await updateSubmittedRequest(db,previous,{shipments:[{...row,shipmentFormula:selected}]},false,0,200,undefined,false);
 expect(saved.shipments![0]!.shipmentFormula).toEqual(selected);
 const changed=await updateSubmittedRequest(db,saved,{requestedFormulas:[{productName:'Changed',productForm:'powder',ouncesPrescribed:10}]});
 const resent=await updateSubmittedRequest(db,changed,{shipments:changed.shipments},false,0,200,undefined,false);
 expect(resent.shipments![0]!.shipmentFormula).toEqual(selected);
 await expect(updateSubmittedRequest(db,saved,{shipments:[{...saved.shipments![0]!,shipmentFormula:shipmentFormulaOptions(previous)[0]}]},false,undefined,200)).rejects.toMatchObject({statusCode:409});
});
