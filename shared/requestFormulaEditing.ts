import type { RequestRecord } from './domain';
import { requestFormulas, formulaOverviewUpdates } from './requestPresentation';
import { findFormula, requiresReadyToFeedReason } from './formulaCatalog';
import { blankFormula, formulaEntryName, type FormulaEntry } from './formulaEntries';

export function editableRequestFormulas(request: Partial<RequestRecord>): FormulaEntry[] {
    return requestFormulas(request).map(formula => {
        const name = formula.otherFormulaName || formula.productName;
        const listed = findFormula(name);
        return {
            ...blankFormula(),
            formulaName: listed?.name ?? 'Other',
            otherFormulaName: listed ? '' : name,
            productForm: formula.productForm ?? '',
            formulaFlavor: formula.flavor ?? '',
            ouncesPrescribed: formula.ouncesPrescribed ?? '',
            readyToFeedJustification: formula.readyToFeedJustification ?? '',
        };
    });
}
export function requestFormulaUpdates(draft: Partial<RequestRecord>, entries: FormulaEntry[]): Partial<RequestRecord> {
    const requestedFormulas = entries.map(entry => ({
        productName:formulaEntryName(entry),
        otherFormulaName:entry.formulaName.trim().toLowerCase() === 'other' ? entry.otherFormulaName.trim() : undefined,
        productForm:entry.productForm as NonNullable<RequestRecord['productForm']>,
        flavor:findFormula(entry.formulaName)?.hasFlavor ? entry.formulaFlavor.trim() : undefined,
        ouncesPrescribed:Number(entry.ouncesPrescribed),
        readyToFeedJustification:requiresReadyToFeedReason(entry.formulaName,entry.productForm) ? entry.readyToFeedJustification : '',
    }));
    const first = requestedFormulas[0]!;
    return {...formulaOverviewUpdates({...draft, requestedFormulas,productName:first.productName,productForm:first.productForm,formulaFlavor:first.flavor,ouncesPrescribed:first.ouncesPrescribed,genericFields:{...draft.genericFields,readyToFeedJustification:first.readyToFeedJustification}}),requestedFormulas};
}
