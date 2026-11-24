import type { ProductForm, ProductRecord } from './domain';

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

export function catalogFormulaOptions(products: ProductRecord[] = []): FormulaOption[] {
    const options = formulaCatalog.map(formula => ({ ...formula, forms: [...formula.forms] }));
    for (const product of products) {
        const name = product.name.trim();
        if (!name) continue;
        let option = options.find(formula => formula.name.toLowerCase() === name.toLowerCase());
        if (!option) {
            option = { name, forms: [], pdfField: '' };
            options.push(option);
        }
        if (['powder', 'concentrate', 'ready-to-feed'].includes(product.form) && !option.forms.includes(product.form as ProductForm)) option.forms.push(product.form as ProductForm);
        if (product.flavor?.trim() || product.genericFields?.flavor?.trim()) option.hasFlavor = true;
    }
    return options.map(option => option.forms.length ? option : { ...option, forms: ['powder', 'concentrate', 'ready-to-feed'] as ProductForm[] });
}

export function activeProductFormulaOptions(products: ProductRecord[]): FormulaOption[] {
    const options = new Map<string, FormulaOption>();
    for (const product of products) {
        const name = product.name.trim();
        const form = product.form;
        if (product.active === false || !name || !['powder', 'concentrate', 'ready-to-feed'].includes(form)) continue;
        const key = name.toLowerCase();
        const option = options.get(key) ?? { name, forms: [], pdfField: '' };
        if (!option.forms.includes(form as ProductForm)) option.forms.push(form as ProductForm);
        if (product.flavor?.trim() || product.genericFields?.flavor?.trim()) option.hasFlavor = true;
        options.set(key, option);
    }
    return [...options.values()];
}

export function findFormula(name: string, products: ProductRecord[] = []) {
    return catalogFormulaOptions(products).find((formula) => formula.name.toLowerCase() === name.trim().toLowerCase());
}

export function availableFormulaForms(name: string, products: ProductRecord[] = []): ProductForm[] {
    if (name.trim().toLowerCase() === 'other') return ['powder', 'concentrate', 'ready-to-feed'];
    return findFormula(name, products)?.forms ?? [];
}

export function defaultFormulaForm(name: string, products: ProductRecord[] = []): ProductForm | '' {
    const forms = availableFormulaForms(name, products);
    return forms.length === 1 ? forms[0]! : '';
}

export function requiresReadyToFeedReason(name: string, form: string, products: ProductRecord[] = []) {
    return form === 'ready-to-feed' && availableFormulaForms(name, products).length > 1;
}
