import {it,expect} from 'vitest';
import {transferCatalogUnitsPerCase} from '../shared/requestTransfers';
import type {ProductRecord} from '../shared/domain';
const product=(size:number)=>({name:'Example Formula',form:'powder',unitsPerCase:size} as ProductRecord);
it('prefills matching packaging without guessing across products or ambiguous case sizes',()=>{
 const lot={formulaName:'Example Formula',form:'powder',flavor:''};
 expect(transferCatalogUnitsPerCase(lot,[product(6)])).toBe(6);
 expect(transferCatalogUnitsPerCase(lot,[product(6),product(12)])).toBeUndefined();
 expect(transferCatalogUnitsPerCase({...lot,formulaName:'Other'},[product(6)])).toBeUndefined();
 expect(transferCatalogUnitsPerCase({...lot,form:'ready-to-feed'},[product(6)])).toBeUndefined();
});
it('converts cases and additional units to an exact transfer total',async()=>{
 const {transferEntryQuantity}=await import('../shared/requestTransfers');
 expect(transferEntryQuantity({casesShipped:2,looseUnitsShipped:1,unitsPerCase:6})).toBe(13);
 expect(transferEntryQuantity({casesShipped:0,looseUnitsShipped:4,unitsPerCase:6})).toBe(4);
 expect(transferEntryQuantity({casesShipped:2,looseUnitsShipped:1})).toBeUndefined();
 expect(transferEntryQuantity({casesShipped:-1,looseUnitsShipped:0,unitsPerCase:6})).toBeUndefined();
});
it('explains missing stock and invalid quantities before authorization',async()=>{
 const {transferAuthorizationError}=await import('../shared/requestTransfers');
 const request={agencyId:10,productName:'Example Formula',productForm:'powder'} as const;
 const row={shipmentSource:'agency' as const,sourceAgencyId:11,eta:'',carrier:'gso' as const,casesShipped:2,unitsPerCase:6,looseUnitsShipped:0,trackingNumbers:[]};
 expect(transferAuthorizationError(request,row,[])).toContain('No verified surplus');
 const lot={id:'stock',agencyId:11,formulaName:'Example Formula',form:'powder',flavor:'',expirationDate:'2099-01-01',onHand:20,reserved:0,expiredUnits:0,version:1};
 expect(transferAuthorizationError(request,row,[lot])).toContain('Select Available Surplus');
 expect(transferAuthorizationError(request,{...row,sourceLotId:'stock'},[lot])).toBe('');
 expect(transferAuthorizationError(request,{...row,sourceLotId:'stock',casesShipped:4},[lot])).toContain('20 units');
});
