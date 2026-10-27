import {describe,it,expect} from 'vitest';
import * as entries from '../shared/formulaEntries';
describe('formula entry field validation',()=>{
 it('rejects a listed formula entered through Other, regardless of casing or extra spaces',()=>{
  const base={...entries.blankFormula(),formulaName:'Other',productForm:'ready-to-feed' as const,ouncesPrescribed:24};
  for(const name of ['Fortini',' fortini ','Kate   Farms Pediatric Std 1.2 Cal']){
   expect(entries.validateFormulaEntry({...base,otherFormulaName:name})).toMatch(/already.*list/i);
  }
  expect(entries.validateFormulaEntry({...base,otherFormulaName:'Unlisted Test Formula',readyToFeedJustification:'Only form available'})).toBe('');
 });
 it('returns every formula field error together instead of only the first',()=>{
  const errors=entries.getFormulaFieldErrors(entries.blankFormula());
  expect(Object.keys(errors).sort()).toEqual(['formulaName','ouncesPrescribed','productForm']);
  const conditional=entries.getFormulaFieldErrors({...entries.blankFormula(),formulaName:'Other',productForm:'ready-to-feed',ouncesPrescribed:24});
  expect(Object.keys(conditional).sort()).toEqual(['otherFormulaName','readyToFeedJustification']);
 });
});
