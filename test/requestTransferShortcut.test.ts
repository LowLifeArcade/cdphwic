import {it,expect} from 'vitest';
import {matchingLocalSurplusLot,surplusShipmentDraft} from '../shared/requestTransfers';
import type {ProductRecord,RequestRecord} from '../shared/domain';
const request={id:1,agencyId:10,productName:'Nutramigen LGG',productForm:'powder',status:'in_progress'} as RequestRecord;
const lot={id:'stock',agencyId:11,formulaName:'Nutramigen LGG',form:'powder',flavor:'',expirationDate:'2099-01-01',onHand:20,reserved:4,expiredUnits:0,version:1};
it('opens a compatible request shipment with selected source stock and packaging but no automatic reservation',()=>{
 const row=surplusShipmentDraft(request,lot,[{name:'Nutramigen LGG',form:'powder',unitsPerCase:6} as ProductRecord]);
 expect(row).toMatchObject({shipmentSource:'agency',sourceAgencyId:11,sourceLotId:'stock',unitsPerCase:6,casesShipped:0,carrier:'gso',trackingNumbers:[]});
 expect(row?.transferId).toBeUndefined();
});
it('does not offer same-agency, mismatched, unavailable, expired stock or ineligible requests',()=>{
 for(const changed of [{agencyId:10},{formulaName:'Other'},{form:'ready-to-feed'},{onHand:4},{expiredUnits:1},{expirationDate:'2000-01-01'}])expect(surplusShipmentDraft(request,{...lot,...changed},[])).toBeUndefined();
 for(const status of ['denied','incomplete'] as const)expect(surplusShipmentDraft({...request,status},lot,[])).toBeUndefined();
});
it('selects the matching formula on a multi-formula request',()=>{
 const multi={...request,requestedFormulas:[{productName:'Other',productForm:'powder' as const,ouncesPrescribed:1},{productName:'Nutramigen LGG',productForm:'powder' as const,ouncesPrescribed:1}]};
 expect(surplusShipmentDraft(multi,lot,[])?.shipmentFormula?.productName).toBe('Nutramigen LGG');
});
it('matches local on-hand surplus despite harmless form and whitespace formatting differences',()=>{
 const formula={productName:'Nutramigen  LGG',productForm:'ready-to-feed' as const,ouncesPrescribed:1,flavor:'Vanilla'};
 const localLot={...lot,agencyId:10,formulaName:'Nutramigen LGG',form:'Ready To Feed',flavor:' Vanilla '};
 expect(matchingLocalSurplusLot(formula,localLot,10)).toBe(true);
 expect(matchingLocalSurplusLot(formula,{...localLot,agencyId:11},10)).toBe(false);
 expect(matchingLocalSurplusLot(formula,{...localLot,flavor:'Chocolate'},10)).toBe(false);
});
it('matches the selected catalog product name when the submitted formula includes a catalog alias',()=>{
 const formula={productName:'Kate Farms Pediatric Std 1.2 Cal',productForm:'ready-to-feed' as const,ouncesPrescribed:1,flavor:'Vanilla'};
 const localLot={...lot,agencyId:10,formulaName:'Kate Farms Pediatric Std 1.2',form:'ready-to-feed',flavor:'Vanilla'};
 expect(matchingLocalSurplusLot(formula,localLot,10,'Vanilla','Kate Farms Pediatric Std 1.2')).toBe(true);
});
