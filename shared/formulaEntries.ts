import type { ProductForm, ProductRecord } from './domain';
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
export function formulaEntryName(entry: FormulaEntry, products: ProductRecord[] = []) {
    return entry.formulaName.trim().toLowerCase() === 'other' ? entry.otherFormulaName.trim() : findFormula(entry.formulaName, products)?.name ?? entry.formulaName.trim();
}
export function validateOtherFormulaName(name: string, products: ProductRecord[] = []) {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.toLowerCase() === 'other') return 'Enter an Other Formula Name.';
    if (findFormula(normalized, products)) return 'This formula is already on the list. Select it under Formula Name instead of Other.';
    return '';
}

export function getFormulaFieldErrors(entry: FormulaEntry, products: ProductRecord[] = []): Partial<Record<keyof FormulaEntry, string>> {
    const errors: Partial<Record<keyof FormulaEntry, string>> = {};
    const other = entry.formulaName.trim().toLowerCase() === 'other';
    if (!findFormula(entry.formulaName, products) && !other) errors.formulaName = 'Select Formula Name or enter Other.';
    if (other) {
        const error = validateOtherFormulaName(entry.otherFormulaName, products);
        if (error) errors.otherFormulaName = error;
    }
    if (!entry.productForm || !availableFormulaForms(entry.formulaName, products).includes(entry.productForm)) errors.productForm = 'Select an available Form.';
    if (!Number.isFinite(Number(entry.ouncesPrescribed)) || Number(entry.ouncesPrescribed) <= 0) errors.ouncesPrescribed = 'Enter Amount Per Day greater than zero.';
    if (requiresReadyToFeedReason(entry.formulaName, entry.productForm, products) && !entry.readyToFeedJustification.trim()) errors.readyToFeedJustification = 'List reason(s) why ready-to-feed is needed.';
    return errors;
}

export function validateFormulaEntry(entry: FormulaEntry, products: ProductRecord[] = []) {
    return Object.values(getFormulaFieldErrors(entry, products))[0] ?? '';
}

export function validateFormulaSelection(entries: Array<{ name: string; form?: string; flavor?: string }>, products: ProductRecord[] = []) {
    if (entries.length > 2) return 'Only up to 2 formulas are allowed. Remove the additional formula(s).';
    const normalize = (value: string | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const identities = entries.flatMap((entry) => {
        const name = normalize(entry.name);
        const form = normalize(entry.form);
        if (!name || !form) return [];
        const flavorApplies = findFormula(entry.name, products)?.hasFlavor;
        const flavor = flavorApplies ? normalize(entry.flavor) : '';
        if (flavorApplies && !flavor) return [];
        return [JSON.stringify([name, form, flavor])];
    });
    if (new Set(identities).size !== identities.length) return 'Formula 2 should not be identical to Formula 1. Select or enter a different formula, form, or flavor (if applicable).';
    return '';
}
