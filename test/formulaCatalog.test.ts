import { describe, expect, it } from 'vitest';
import { formulaCatalog, findFormula, availableFormulaForms, defaultFormulaForm, requiresReadyToFeedReason } from '../shared/formulaCatalog';

describe('request formula catalog', () => {
    it('contains all 27 requested names without duplicates', () => {
        expect(formulaCatalog).toHaveLength(27);
        expect(new Set(formulaCatalog.map(({ name }) => name)).size).toBe(27);
    });
    it('requires a choice for multiple forms and selects the sole form otherwise', () => {
        expect(defaultFormulaForm('Nutramigen')).toBe('');
        expect(defaultFormulaForm('Fortini')).toBe('ready-to-feed');
        expect(defaultFormulaForm('EleCare Infant')).toBe('powder');
        expect(defaultFormulaForm('')).toBe('');
    });
    it('only requires a reason when ready-to-feed is an alternative form', () => {
        expect(requiresReadyToFeedReason('Fortini', 'ready-to-feed')).toBe(false);
        expect(requiresReadyToFeedReason('Kate Farms Pediatric Std 1.2 Cal', 'ready-to-feed')).toBe(false);
        expect(findFormula('Kate Farms Pediatric Std 1.2 Cal')?.hasFlavor).toBe(true);
        expect(requiresReadyToFeedReason('Similac NeoSure', 'ready-to-feed')).toBe(true);
        expect(requiresReadyToFeedReason('Other', 'ready-to-feed')).toBe(true);
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
