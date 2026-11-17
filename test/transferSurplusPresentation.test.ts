import {it,expect} from 'vitest';
import {transferLotFormulaLabel} from '../shared/requestTransfers';

it('keeps available surplus formula options concise and readable',()=>{
 expect(transferLotFormulaLabel({formulaName:'Nutramigen',form:'ready-to-feed'})).toBe('Nutramigen RTF');
 expect(transferLotFormulaLabel({formulaName:'EleCare',form:'powder'})).toBe('EleCare PWD');
 expect(transferLotFormulaLabel({formulaName:'Enfamil',form:'concentrate'})).toBe('Enfamil CONC');
});
