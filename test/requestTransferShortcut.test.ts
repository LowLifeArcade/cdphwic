import {it,expect} from 'vitest';
import {surplusShipmentDraft} from '../shared/requestTransfers';
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
