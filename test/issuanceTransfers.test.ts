import {it,expect} from 'vitest';
import {issuanceTransferLots,setIssuanceTransferUnits} from '../shared/issuanceTransfers';
import type {SurplusLot} from '../shared/surplus';
const request={agencyId:10,productName:'Fortini',productForm:'ready-to-feed' as const,status:'approved' as const};
const formula={productName:'Fortini',productForm:'ready-to-feed' as const};
const lot:SurplusLot={id:'stock',agencyId:11,formulaName:'Fortini',form:'ready-to-feed',flavor:'',expirationDate:'2027-03-01',onHand:20,reserved:2,expiredUnits:0,version:0};
it('finds matching available surplus across other agencies',()=>{
 const lots=[lot,{...lot,id:'own',agencyId:10},{...lot,id:'expired',expirationDate:'2026-01-01'},{...lot,id:'reserved',reserved:20},{...lot,id:'empty',onHand:0},{...lot,id:'fully-reserved',reserved:20},{...lot,id:'at-sixty-days',expirationDate:'2027-01-16'},{...lot,id:'other',formulaName:'Other'}];
 expect(issuanceTransferLots(request,formula,lots,'2026-11-17').map(row=>row.id)).toEqual(['stock']);
});
it('finds the selected catalog variant when the request uses an alias and omitted flavor',()=>{
 const requestWithAlias={agencyId:10,requestedFormulas:[{productName:'Kate Farms Pediatric Std 1.2 Cal',productForm:'ready-to-feed' as const,ouncesPrescribed:0}],formulaAuthorizations:[{productName:'Kate Farms Pediatric Std 1.2 Cal',formulaName:'Kate Farms Pediatric Std 1.2',productForm:'ready-to-feed' as const,flavor:'Vanilla',benefitIssuances:[]}]};
 const catalogLot={...lot,formulaName:'Kate Farms Pediatric Std 1.2',flavor:'Vanilla'};
 const selected={productName:'Kate Farms Pediatric Std 1.2 Cal',productForm:'ready-to-feed' as const};
 expect(issuanceTransferLots(requestWithAlias,selected,[catalogLot],'2026-11-17')).toEqual([catalogLot]);
});
it('creates and updates one transfer draft using total units and whole cases',()=>{
 const rows=setIssuanceTransferUnits([],formula,lot,10,4);
 expect(rows[0]).toMatchObject({sourceLotId:'stock',sourceAgencyId:11,shipmentSource:'agency',casesShipped:2,looseUnitsShipped:2,unitsToTransfer:10});
 expect(setIssuanceTransferUnits(rows,formula,lot,6,4)).toHaveLength(1);
 expect(setIssuanceTransferUnits(rows,formula,lot,0,4)).toHaveLength(0);
});
it('rejects over-allocation and preserves reserved transfers when adding another allocation',()=>{
 expect(()=>setIssuanceTransferUnits([],formula,lot,19,4)).toThrow('18');
 const rows=setIssuanceTransferUnits([],formula,lot,4,4).map(row=>({...row,transferId:'reserved'}));
 const next=setIssuanceTransferUnits(rows,formula,lot,8,4);expect(next).toHaveLength(2);expect(next[0]).toEqual(rows[0]);expect(next[1]?.unitsToTransfer).toBe(8);
});
it('requires a known case size and a positive whole unit selection',()=>{
 expect(()=>setIssuanceTransferUnits([],formula,lot,2)).toThrow('Units Per Case');
 expect(()=>setIssuanceTransferUnits([],formula,lot,1.5,4)).toThrow('whole');
});

it('reuses the initial blank shipment for the first transfer reservation',()=>{
 const rows=setIssuanceTransferUnits([{eta:'',casesShipped:0,carrier:'fedex',trackingNumbers:[]}],formula,lot,4,4);
 expect(rows).toHaveLength(1);expect(rows[0]?.sourceLotId).toBe('stock');
});
