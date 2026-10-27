import type { ProductForm } from './domain';

export interface FormulaOption {
    name: string;
    forms: ProductForm[];
    pdfField: string;
    hasFlavor?: boolean;
}

export const formulaCatalog: FormulaOption[] = [
    { name: 'Enfamil NeuroPro EnfaCare', forms: ['powder', 'ready-to-feed'], pdfField: 'Enfamil-1' },
    { name: 'Similac NeoSure', forms: ['powder', 'ready-to-feed'], pdfField: 'Similac-1' },
    { name: 'Kate Farms Pediatric Std 1.2 Cal', forms: ['ready-to-feed'], pdfField: 'Kate Farms', hasFlavor: true },
    { name: 'PediaSure', forms: ['ready-to-feed'], pdfField: 'PediaSure-1', hasFlavor: true },
    { name: 'PediaSure with Fiber', forms: ['ready-to-feed'], pdfField: 'PediaSure-2' },
    { name: 'PediaSure 1.5 Cal', forms: ['ready-to-feed'], pdfField: 'PediaSure3' },
    { name: 'PediaSure 1.5 Cal with Fiber', forms: ['ready-to-feed'], pdfField: 'PediaSure-4' },
    { name: 'Fortini', forms: ['ready-to-feed'], pdfField: 'Fortini' },
    { name: 'Similac PM 60/40', forms: ['powder'], pdfField: 'Similac pm 60 40' },
    { name: 'Alfamino Infant', forms: ['powder'], pdfField: 'Alfamino-1' },
    { name: 'Alfamino Jr, Unflavored', forms: ['powder'], pdfField: 'Alfamino-2' },
    { name: 'Alfamino Jr, Vanilla', forms: ['powder'], pdfField: 'Alfamino-3' },
    { name: 'EleCare Infant', forms: ['powder'], pdfField: 'EleCare-1' },
    { name: 'EleCare Jr, Unflavored', forms: ['powder'], pdfField: 'EleCare-2' },
    { name: 'EleCare Jr, Vanilla', forms: ['powder'], pdfField: 'EleCare-3' },
    { name: 'Extensive HA', forms: ['powder'], pdfField: 'Extensive HA' },
    { name: 'Neocate Infant', forms: ['powder'], pdfField: 'Neocate-1' },
    { name: 'Neocate Jr, Unflavored', forms: ['powder'], pdfField: 'Neocate-2' },
    { name: 'Neocate Jr, Vanilla', forms: ['powder'], pdfField: 'Neocate-3' },
    { name: 'Neocate Syneo Infant', forms: ['powder'], pdfField: 'Neocate-4' },
    { name: 'Nutramigen', forms: ['concentrate', 'ready-to-feed'], pdfField: 'Nutramigen-1' },
    { name: 'Nutramigen LGG', forms: ['powder'], pdfField: 'Nutramigen-2' },
    { name: 'PurAmino', forms: ['powder'], pdfField: 'PurAmino-1' },
    { name: 'PurAmino Jr, Unflavored', forms: ['powder'], pdfField: 'PurAmino-2' },
    { name: 'PurAmino Jr, Vanilla', forms: ['powder'], pdfField: 'PurAmino-3' },
    { name: 'Similac Alimentum', forms: ['powder', 'ready-to-feed'], pdfField: 'Similac alimentum-1' },
    { name: 'Similac Alimentum Toddler', forms: ['powder'], pdfField: 'Similac alimentum-2' },
];

export function findFormula(name: string) {
    return formulaCatalog.find((formula) => formula.name.toLowerCase() === name.trim().toLowerCase());
}

export function availableFormulaForms(name: string): ProductForm[] {
    if (name.trim().toLowerCase() === 'other') return ['powder', 'concentrate', 'ready-to-feed'];
    return findFormula(name)?.forms ?? [];
}

export function defaultFormulaForm(name: string): ProductForm | '' {
    const forms = availableFormulaForms(name);
    return forms.length === 1 ? forms[0]! : '';
}

export function requiresReadyToFeedReason(name: string, form: string) {
    return form === 'ready-to-feed' && availableFormulaForms(name).length > 1;
}
