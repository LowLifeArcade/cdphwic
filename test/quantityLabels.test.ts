import {expect,it} from 'vitest';
import {unitLabel} from '../shared/quantityLabels';
it.each([[0,'Units'],[1,'Unit'],[2,'Units'],[12,'Units'],['1','Unit'],[undefined,'Units']])('labels %s as %s',(quantity,label)=>{
 expect(unitLabel(quantity)).toBe(label);
});
