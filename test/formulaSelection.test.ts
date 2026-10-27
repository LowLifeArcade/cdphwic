import { describe, expect, it } from 'vitest';
import { validateFormulaSelection } from '../shared/formulaEntries';

describe('request formula count and duplicates', () => {
    it('allows the same name with different forms', () => {
        expect(validateFormulaSelection([{ name: 'Similac NeoSure', form: 'powder' }, { name: 'Similac NeoSure', form: 'ready-to-feed' }])).toBe('');
    });
    it('requires name and form to match before reporting a duplicate', () => {
        expect(validateFormulaSelection([{ name: 'Fortini', form: 'ready-to-feed' }, { name: ' fortini ', form: 'ready-to-feed' }])).toContain('not be identical');
        expect(validateFormulaSelection([{ name: 'Fortini', form: 'ready-to-feed' }, { name: 'Fortini', form: '' }])).toBe('');
    });
    it('also compares flavors when applicable and waits for flavor entry', () => {
        const first = { name: 'PediaSure', form: 'ready-to-feed', flavor: 'Vanilla' };
        expect(validateFormulaSelection([first, { ...first, flavor: 'Chocolate' }])).toBe('');
        expect(validateFormulaSelection([first, { ...first, flavor: '' }])).toBe('');
        expect(validateFormulaSelection([first, { ...first, flavor: ' vanilla ' }])).toContain('not be identical');
        expect(validateFormulaSelection([{ name: 'Fortini', form: 'ready-to-feed', flavor: 'A' }, { name: 'Fortini', form: 'ready-to-feed', flavor: 'B' }])).toContain('not be identical');
    });
    it('still limits the request to two entries', () => {
        expect(validateFormulaSelection([{ name: '' }, { name: '' }])).toBe('');
        expect(validateFormulaSelection([{ name: 'Fortini' }, { name: 'Similac NeoSure' }, { name: 'PediaSure' }])).toContain('2 formulas');
    });
});
