import {it,expect} from 'vitest';
import {showDamageRequirements} from '../shared/distributors';
const row={eta:'2026-11-01',casesShipped:1,carrier:'ups' as const,trackingNumbers:['A']};
it('shows requirements only in Local Agency damage reporting',()=>{
 expect(showDamageRequirements('agency',row,false)).toBe(false);
 expect(showDamageRequirements('agency',row,true)).toBe(true);
 expect(showDamageRequirements('agency',{...row,damagedUnits:2},false)).toBe(true);
 expect(showDamageRequirements('agency',{...row,issue:{type:'missing',notes:'Missing',reportedAt:'2026-10-29',reportedBy:100}},false)).toBe(false);
 for(const identity of ['internal','admin'])expect(showDamageRequirements(identity,{...row,damagedUnits:2},true)).toBe(false);
});
