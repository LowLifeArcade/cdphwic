import {expect,it} from 'vitest';
import {editableRequestFormulas,requestFormulaUpdates} from '../shared/requestFormulaEditing';
import {blankFormula,validateFormulaSelection} from '../shared/formulaEntries';

it('restores each formula as a separate editable entry, including off-list names', () => {
    const entries = editableRequestFormulas({requestedFormulas:[{productName:'PediaSure',productForm:'ready-to-feed',flavor:'Vanilla',ouncesPrescribed:20},{productName:'Example specialty formula',productForm:'powder',ouncesPrescribed:12,otherFormulaName:'Example specialty formula'}]});
    expect(entries).toHaveLength(2);
    expect(entries[0]!.formulaName).toBe('PediaSure');
    expect(entries[0]!.formulaFlavor).toBe('Vanilla');
    expect(entries[1]!.formulaName).toBe('Other');
    expect(entries[1]!.otherFormulaName).toBe('Example specialty formula');
});
it('saves both formulas and keeps the first formula summary synchronized', () => {
    const entries = [{...blankFormula(),formulaName:'Nutramigen',productForm:'ready-to-feed' as const,ouncesPrescribed:'20',readyToFeedJustification:'Example reason'},{...blankFormula(),formulaName:'PediaSure',productForm:'ready-to-feed' as const,formulaFlavor:'Vanilla',ouncesPrescribed:'12'}];
    const result = requestFormulaUpdates({durationMonths:3,diagnosis:'Prematurity'},entries);
    expect(result.requestedFormulas).toHaveLength(2);
    expect(result.productName).toBe('Nutramigen');
    expect(result.ouncesPrescribed).toBe(20);
    expect(result.requestedFormulas![1]!.flavor).toBe('Vanilla');
    expect(result.durationMonths).toBe(3);
    expect(result.diagnosis).toBe('Prematurity');
    expect(editableRequestFormulas(result)).toEqual(entries.map(entry=>({...entry,ouncesPrescribed:Number(entry.ouncesPrescribed)})));
    expect(requestFormulaUpdates(result,entries.slice(0,1)).requestedFormulas).toHaveLength(1);
});
it('shares New Request duplicate rules for name, form, and flavor', () => {
    expect(validateFormulaSelection([{name:'PediaSure',form:'ready-to-feed',flavor:'Vanilla'},{name:'PediaSure',form:'ready-to-feed',flavor:'Chocolate'}])).toBe('');
    expect(validateFormulaSelection([{name:'PediaSure',form:'ready-to-feed',flavor:'Vanilla'},{name:'PediaSure',form:'ready-to-feed',flavor:'Vanilla'}])).toContain('identical');
});
