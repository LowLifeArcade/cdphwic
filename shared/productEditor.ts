import type { ProductRecord } from './domain';

type EditorField = {
    key: keyof ProductRecord | 'unitUpc' | 'caseBarcode';
    label: string;
    type?: 'textarea' | 'number' | 'select';
    options?: readonly string[];
};
export const productEditorFields = [
    { key: 'formulaDescription', label: 'Formula Description', type: 'textarea' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'name', label: 'Formula Name' },
    { key: 'form', label: 'Form', type: 'select', options: ['powder', 'concentrate', 'ready-to-feed', 'other'] },
    { key: 'flavor', label: 'Flavor' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'productCode', label: 'Product Number' },
    { key: 'unitsPerCase', label: 'Units Per Case', type: 'number' },
    { key: 'yield', label: 'Yield', type: 'number' },
    { key: 'coveredByMediCal', label: 'Covered by Medi-Cal', type: 'select', options: ['yes', 'no'] },
    { key: 'mcKessonPo', label: 'McKesson PO' },
    { key: 'mcKessonPrice', label: 'McKesson Price', type: 'number' },
    { key: 'fdaClass', label: 'FDA Class', type: 'select', options: ['Exempt', 'Non-exempt', 'Not infant'] },
    { key: 'wicClass', label: 'WIC Category', type: 'select', options: ['Exempt', 'Nutritional', 'Contract', 'SNC'] },
    { key: 'st', label: 'S/T', type: 'select', options: ['Standard', 'Therapeutic'] },
    { key: 'infantToddler', label: 'Infant/Toddler', type: 'select', options: ['Infant', 'Toddler', 'Adult'] },
] as const satisfies readonly EditorField[];

export const productBarcodeFields = [
    { key: 'unitUpc', label: 'Unit UPC' },
    { key: 'caseBarcode', label: 'Case Barcode' },
] as const;

type EditorKey = (typeof productEditorFields | typeof productBarcodeFields)[number]['key'];
export type ProductEditor = Record<EditorKey, string>;
export type ProductEditorInput = Omit<ProductRecord, 'id' | 'unitsPerCase' | 'yield' | 'mcKessonPrice' | 'coveredByMediCal'> & {
    unitsPerCase?: number | null;
    yield?: number | null;
    mcKessonPrice?: number | null;
    coveredByMediCal?: boolean | null;
};

export function createProductEditor(product?: ProductRecord): ProductEditor {
    return Object.fromEntries([...productEditorFields, ...productBarcodeFields].map(({ key }) => [key,
        key === 'coveredByMediCal'
            ? product?.coveredByMediCal == null ? '' : product.coveredByMediCal ? 'yes' : 'no'
            : key === 'unitUpc' || key === 'caseBarcode'
              ? product?.genericFields?.[key] ?? ''
              : String(product?.[key] ?? ''),
    ])) as ProductEditor;
}

export function productEditorOptions(field: EditorField, current: string): string[] {
    const options = ['', ...(field.options ?? [])];
    return current && !options.includes(current) ? [...options, current] : options;
}

export function productEditorOptionLabel(value: string): string {
    return ({ '': 'Not specified', powder: 'Powder', concentrate: 'Liquid Concentrate', 'ready-to-feed': 'Ready-to-Feed', other: 'Other', yes: 'Yes', no: 'No' } as Record<string, string>)[value] ?? value;
}

export function productEditorBody(product: ProductRecord, form: ProductEditor): ProductEditorInput {
    const { unitUpc, caseBarcode, ...fields } = form;
    const genericFields = { ...product.genericFields };
    for (const [key, value] of Object.entries({ unitUpc, caseBarcode })) {
        if (value?.trim()) genericFields[key] = value.trim();
        else delete genericFields[key];
    }
    const coverage = [...product.coverage];
    if (form.coveredByMediCal === 'yes' && !coverage.includes('medical')) coverage.push('medical');
    return {
        ...product,
        ...fields,
        genericFields,
        form: form.form as ProductRecord['form'],
        unitsPerCase: form.unitsPerCase === '' ? null : Number(form.unitsPerCase),
        yield: form.yield === '' ? null : Number(form.yield),
        mcKessonPrice: form.mcKessonPrice === '' ? null : Number(form.mcKessonPrice),
        coveredByMediCal: form.coveredByMediCal === '' ? null : form.coveredByMediCal === 'yes',
        coverage: form.coveredByMediCal === 'no' ? coverage.filter(value => value !== 'medical') : coverage,
    };
}
