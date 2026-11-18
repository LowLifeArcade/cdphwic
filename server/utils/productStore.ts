import { SEED_PRODUCTS } from '../data/seed';
import type { ProductCoverage, ProductForm, ProductRecord } from '../../shared/domain';

export type ProductInput = Omit<
    ProductRecord,
    'id' | 'coverage' | 'casesRemaining' | 'dollarsApproved' | 'dollarsUsed' | 'dollarsRemaining'
> & { coverage?: ProductCoverage[]; importRowNumber?: number };
export type ProductQuantityUpdate = {
    productId: string;
    casesApproved: number;
    casesUsed: number;
};

const products = [...SEED_PRODUCTS];
let nextProductId = Math.max(...products.map((product) => product.id)) + 1;

export function listProducts(): ProductRecord[] {
    return structuredClone(products.map(withQuantityTotals));
}

export function getProduct(id: number): ProductRecord {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) {
        throw new Error(`No product found with id ${id}.`);
    }
    return structuredClone(withQuantityTotals(product));
}

export function validateProductInput(input: Partial<ProductInput>): string[] {
    const errors: string[] = [];
    const categories = ['standard', 'exempt', 'nutritional'];
    const forms: ProductForm[] = ['powder', 'concentrate', 'ready-to-feed'];

    if (!String(input.productId ?? '').trim()) {
        errors.push('Product ID is required.');
    }
    if (!String(input.productCode ?? '').trim()) {
        errors.push('Product code is required.');
    }
    if (!String(input.name ?? '').trim()) {
        errors.push('Name is required.');
    }
    const normalizedForm = String(input.form ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
    if (!forms.includes(normalizedForm as ProductForm)) {
        errors.push('Form must be powder, concentrate, or ready-to-feed.');
    }
    if (!categories.includes(String(input.category ?? ''))) {
        errors.push('Category must be standard, exempt, or nutritional.');
    }
    if (!Number.isFinite(Number(input.unitsPerCase)) || Number(input.unitsPerCase) <= 0) {
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

    if (input.mcKessonPrice !== undefined && (!Number.isFinite(Number(input.mcKessonPrice)) || Number(input.mcKessonPrice) < 0)) {
        errors.push('McKesson Price must be a nonnegative number.');
    }
    if (input.coveredByMediCal !== undefined && typeof input.coveredByMediCal !== 'boolean') {
        errors.push('Covered by Medi-Cal must be yes or no.');
    }
    for (const [key, label] of [['casesApproved', 'Cases approved'], ['casesUsed', 'Cases used']] as const) {
        if (input[key] !== undefined && (!Number.isSafeInteger(Number(input[key])) || Number(input[key]) < 0)) errors.push(`${label} must be a whole, nonnegative number.`);
    }
    return errors;
}

function normalizeProductInput(input: ProductInput): ProductInput {
    return {
        flavor: input.flavor?.trim() || undefined,
        formulaDescription: input.formulaDescription?.trim() || undefined,
        manufacturer: input.manufacturer?.trim() || undefined,
        mcKessonPo: input.mcKessonPo?.trim() || undefined,
        mcKessonPrice: input.mcKessonPrice === undefined ? undefined : Number(input.mcKessonPrice),
        coveredByMediCal: input.coveredByMediCal,
        fdaClass: input.fdaClass?.trim() || undefined,
        wicClass: input.wicClass?.trim() || undefined,
        st: input.st?.trim() || undefined,
        infantToddler: input.infantToddler?.trim() || undefined,
        packaging: input.packaging?.trim() || undefined,
        name: input.name.trim(),
        form: input.form.trim().toLowerCase().replace(/\s+/g, '-') as ProductForm,
        category: input.category,
        unitsPerCase: Number(input.unitsPerCase),
        yield: input.yield === undefined || input.yield === null || String(input.yield).trim() === '' ? undefined : Number(input.yield),
        coverage: input.coverage?.length ? input.coverage : ['wic'],
        productId: input.productId.trim(),
        productCode: input.productCode.trim(),
        poPrice: input.poPrice === undefined || input.poPrice === null ? input.unitPrice : Number(input.poPrice),
        casesApproved: Number(input.casesApproved ?? 0),
        casesUsed: Number(input.casesUsed ?? 0),
        unitPrice: input.unitPrice === undefined || input.unitPrice === null ? undefined : Number(input.unitPrice),
        supplierReference: input.supplierReference?.trim() || undefined,
        genericFields: input.genericFields,
    };
}

export function createProduct(input: ProductInput): ProductRecord {
    const errors = validateProductInput(input);
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    if (
        products.some(
            (product) =>
                product.productId === input.productId.trim() ||
                product.productCode === input.productCode.trim(),
        )
    ) {
        throw new Error('Product ID and Product Number must be unique.');
    }

    const product: ProductRecord = { id: nextProductId++, ...normalizeProductInput(input) };
    products.push(product);
    return structuredClone(withQuantityTotals(product));
}

export function updateProduct(id: number, input: ProductInput): ProductRecord {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) {
        throw new Error(`No product found with id ${id}.`);
    }

    // Legacy edit forms omit metadata; an explicit empty value still clears it.
    const metadataKeys = ['flavor', 'formulaDescription', 'manufacturer', 'mcKessonPo', 'mcKessonPrice', 'coveredByMediCal', 'fdaClass', 'wicClass', 'st', 'infantToddler', 'packaging', 'yield', 'genericFields'] as const;
    const metadata = Object.fromEntries(metadataKeys.map(key => [key, product[key]]));
    input = { ...metadata, ...input };
    const errors = validateProductInput(input);
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    const normalizedProductId = input.productId.trim();
    if (
        products.some(
            (candidate) =>
                candidate.id !== id &&
                (candidate.productId === normalizedProductId ||
                    candidate.productCode === input.productCode.trim()),
        )
    ) {
        throw new Error('Product ID and Product Number must be unique.');
    }

    Object.assign(product, normalizeProductInput(input));
    return structuredClone(withQuantityTotals(product));
}

export function createProducts(inputs: ProductInput[]): ProductRecord[] {
    const errors = inputs.flatMap((input, index) =>
        validateProductInput(input).map((message) => `Row ${input.importRowNumber ?? index + 2}: ${message}`),
    );
    const productIds = new Set(products.map((product) => product.productId));
    const productCodes = new Set(products.map((product) => product.productCode));
    inputs.forEach((input, index) => {
        const productId = String(input.productId ?? '').trim();
        const productCode = String(input.productCode ?? '').trim();
        if (productIds.has(productId)) errors.push(`Row ${input.importRowNumber ?? index + 2}: Product ID "${productId}" already exists.`);
        if (productCodes.has(productCode)) errors.push(`Row ${input.importRowNumber ?? index + 2}: Product Number "${productCode}" already exists.`);
        productIds.add(productId);
        productCodes.add(productCode);
    });
    if (errors.length) {
        throw new Error(errors.join('\n'));
    }

    return inputs.map((input) => createProduct(input));
}

function withQuantityTotals(product: ProductRecord): ProductRecord {
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

export function updateProducts(updates: ProductQuantityUpdate[]): ProductRecord[] {
    const updated: ProductRecord[] = [];
    for (const update of updates) {
        const product = products.find((candidate) => candidate.productId === update.productId.trim());
        if (!product) {
            throw new Error(`No product found for productId ${update.productId}.`);
        }
        if (update.casesApproved < 0 || update.casesUsed < 0 || update.casesUsed > update.casesApproved) {
            throw new Error(`Invalid quantities for productId ${update.productId}.`);
        }
        product.casesApproved = Number(update.casesApproved);
        product.casesUsed = Number(update.casesUsed);
        updated.push(withQuantityTotals(product));
    }
    return structuredClone(updated);
}
