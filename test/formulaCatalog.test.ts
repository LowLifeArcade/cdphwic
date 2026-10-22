import { describe, expect, it } from 'vitest';
import { formulaCatalog, findFormula, availableFormulaForms } from '../shared/formulaCatalog';

describe('request formula catalog', () => {
    it('contains all 27 requested names without duplicates', () => {
        expect(formulaCatalog).toHaveLength(27);
        expect(new Set(formulaCatalog.map(({ name }) => name)).size).toBe(27);
    });
    it('limits forms for single and multiple form products', () => {
        expect(availableFormulaForms('Nutramigen')).toEqual(['concentrate', 'ready-to-feed']);
        expect(availableFormulaForms('Similac Alimentum')).toEqual(['powder', 'ready-to-feed']);
        expect(availableFormulaForms('Fortini')).toEqual(['ready-to-feed']);
        expect(availableFormulaForms('EleCare Infant')).toEqual(['powder']);
        expect(availableFormulaForms('Unknown')).toEqual([]);
        expect(findFormula(' pediasure ')?.hasFlavor).toBe(true);
        expect(findFormula('PediaSure with Fiber')?.hasFlavor).toBeUndefined();
    });
});
