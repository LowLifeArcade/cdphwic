import type { ProductForm } from './domain';
import { availableFormulaForms, findFormula, requiresReadyToFeedReason } from './formulaCatalog';

export interface FormulaEntry {
    formulaName: string;
    otherFormulaName: string;
    productForm: ProductForm | '';
    formulaFlavor: string;
    ouncesPrescribed: string | number;
    readyToFeedJustification: string;
}

export function blankFormula(): FormulaEntry {
    return { formulaName: '', otherFormulaName: '', productForm: '', formulaFlavor: '', ouncesPrescribed: '', readyToFeedJustification: '' };
}
export function formulaEntryName(entry: FormulaEntry) {
    return entry.formulaName.trim().toLowerCase() === 'other' ? entry.otherFormulaName.trim() : findFormula(entry.formulaName)?.name ?? entry.formulaName.trim();
}
export function validateFormulaEntry(entry: FormulaEntry) {
    const other = entry.formulaName.trim().toLowerCase() === 'other';
    if ((!findFormula(entry.formulaName) && !other) || !formulaEntryName(entry) || formulaEntryName(entry).toLowerCase() === 'other') return 'Select Formula Name or enter an Other Formula Name.';
    const catalogName = other ? findFormula(entry.otherFormulaName)?.name ?? 'Other' : entry.formulaName;
    if (!entry.productForm || !availableFormulaForms(catalogName).includes(entry.productForm)) return 'Select an available Form.';
    if (!Number.isFinite(Number(entry.ouncesPrescribed)) || Number(entry.ouncesPrescribed) <= 0) return 'Enter Amount Per Day greater than zero.';
    if (requiresReadyToFeedReason(catalogName, entry.productForm) && !entry.readyToFeedJustification.trim()) return 'List reason(s) why ready-to-feed is needed.';
    return '';
}

export function validateFormulaSelection(entries: Array<{ name: string; form?: string; flavor?: string }>) {
    if (entries.length > 2) return 'Only up to 2 formulas are allowed. Remove the additional formula(s).';
    const normalize = (value: string | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const identities = entries.flatMap((entry) => {
        const name = normalize(entry.name);
        const form = normalize(entry.form);
        if (!name || !form) return [];
        const flavorApplies = findFormula(entry.name)?.hasFlavor;
        const flavor = flavorApplies ? normalize(entry.flavor) : '';
        if (flavorApplies && !flavor) return [];
        return [JSON.stringify([name, form, flavor])];
    });
    if (new Set(identities).size !== identities.length) return 'Formula 2 is already selected as Formula 1 with the same form and flavor (if applicable). Choose a different formula, form, or flavor.';
    return '';
}
