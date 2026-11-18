import type { ProductCoverage, ProductRecord } from '../../shared/domain';

export type ProductInput = Omit<
    ProductRecord,
    'id' | 'coverage' | 'casesRemaining' | 'dollarsApproved' | 'dollarsUsed' | 'dollarsRemaining' | 'yield' | 'mcKessonPrice' | 'coveredByMediCal'
> & { coverage?: ProductCoverage[]; importRowNumber?: number; yield?: number | null; mcKessonPrice?: number | null; coveredByMediCal?: boolean | null };
export type ProductQuantityUpdate = {
    productId: string;
    casesApproved: number;
    casesUsed: number;
};

export function validateProductInput(input: Partial<ProductInput>, options: { allowBlanks?: boolean } = {}): string[] {
    const errors: string[] = [];
    const categories = ['standard', 'exempt', 'nutritional'];
    const forms = ['powder', 'concentrate', 'ready-to-feed', 'other'];
    const blank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

    if (!options.allowBlanks && blank(input.productId)) {
        errors.push('Product ID is required.');
    }
    if (!options.allowBlanks && blank(input.productCode)) {
        errors.push('Product code is required.');
    }
    if (!options.allowBlanks && blank(input.name)) {
        errors.push('Name is required.');
    }
    const normalizedForm = String(input.form ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
    if (!(options.allowBlanks && !normalizedForm) && !forms.includes(normalizedForm)) {
        errors.push('Form must be powder, concentrate, ready-to-feed, or Other.');
    }
    if (!categories.includes(String(input.category ?? ''))) {
        errors.push('Category must be standard, exempt, or nutritional.');
    }
    if (!(options.allowBlanks && blank(input.unitsPerCase)) && (!Number.isFinite(Number(input.unitsPerCase)) || Number(input.unitsPerCase) <= 0)) {
        errors.push('Units per case must be a positive number.');
    }
    if (input.yield !== undefined && input.yield !== null && (!Number.isFinite(Number(input.yield)) || Number(input.yield) < 0)) {
        errors.push('Yield cannot be negative.');
    }
    if (input.coverage && input.coverage.some((coverage) => !['wic', 'medical'].includes(coverage))) {
        errors.push('Coverage must contain only wic or medical.');
    }
    if (input.unitPrice !== undefined && input.unitPrice !== null && (!Number.isFinite(Number(input.unitPrice)) || Number(input.unitPrice) < 0)) {
        errors.push('Unit price cannot be negative.');
    }
    if (input.poPrice !== undefined && input.poPrice !== null && (!Number.isFinite(Number(input.poPrice)) || Number(input.poPrice) < 0)) {
        errors.push('PO price cannot be negative.');
    }

    if (input.mcKessonPrice !== undefined && input.mcKessonPrice !== null && (!Number.isFinite(Number(input.mcKessonPrice)) || Number(input.mcKessonPrice) < 0)) {
        errors.push('McKesson Price must be a nonnegative number.');
    }
    if (input.coveredByMediCal !== undefined && input.coveredByMediCal !== null && typeof input.coveredByMediCal !== 'boolean') {
        errors.push('Covered by Medi-Cal must be yes or no.');
    }
    for (const [key, label] of [['casesApproved', 'Cases approved'], ['casesUsed', 'Cases used']] as const) {
        if (input[key] !== undefined && (!Number.isSafeInteger(Number(input[key])) || Number(input[key]) < 0)) errors.push(`${label} must be a whole, nonnegative number.`);
    }
    return errors;
}

export function normalizeProductInput(input: ProductInput): Omit<ProductRecord, 'id'> {
    return {
        active: input.active ?? true,
        flavor: input.flavor?.trim() || undefined,
        formulaDescription: input.formulaDescription?.trim() || undefined,
        manufacturer: input.manufacturer?.trim() || undefined,
        mcKessonPo: input.mcKessonPo?.trim() || undefined,
        mcKessonPrice: input.mcKessonPrice === undefined || input.mcKessonPrice === null ? undefined : Number(input.mcKessonPrice),
        coveredByMediCal: input.coveredByMediCal ?? undefined,
        fdaClass: input.fdaClass?.trim() || undefined,
        wicClass: input.wicClass?.trim() || undefined,
        st: input.st?.trim() || undefined,
        infantToddler: input.infantToddler?.trim() || undefined,
        packaging: input.packaging?.trim() || undefined,
        name: input.name.trim(),
        form: input.form.trim().toLowerCase().replace(/\s+/g, '-') as ProductRecord['form'],
        category: input.category,
        unitsPerCase: input.unitsPerCase === undefined || input.unitsPerCase === null || String(input.unitsPerCase).trim() === '' ? undefined : Number(input.unitsPerCase),
        yield: input.yield === undefined || input.yield === null || String(input.yield).trim() === '' ? undefined : Number(input.yield),
        coverage: input.coverage?.length ? input.coverage : ['wic'],
        productId: input.productId.trim() || `IMPORT-${crypto.randomUUID()}`,
        productCode: input.productCode.trim(),
        poPrice: input.poPrice === undefined || input.poPrice === null ? input.unitPrice : Number(input.poPrice),
        casesApproved: Number(input.casesApproved ?? 0),
        casesUsed: Number(input.casesUsed ?? 0),
        unitPrice: input.unitPrice === undefined || input.unitPrice === null ? undefined : Number(input.unitPrice),
        supplierReference: input.supplierReference?.trim() || undefined,
        genericFields: input.genericFields,
    };
}

export function withQuantityTotals(product: ProductRecord): ProductRecord {
    const casesApproved = product.casesApproved ?? 0;
    const casesUsed = product.casesUsed ?? 0;
    const poPrice = product.poPrice ?? product.unitPrice ?? 0;
    return {
        ...product,
        casesApproved,
        casesUsed,
        casesRemaining: casesApproved - casesUsed,
        dollarsApproved: casesApproved * poPrice,
        dollarsUsed: casesUsed * poPrice,
        dollarsRemaining: (casesApproved - casesUsed) * poPrice,
    };
}

