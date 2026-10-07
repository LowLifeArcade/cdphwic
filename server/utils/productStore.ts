import { SEED_PRODUCTS } from '../data/seed';
import type { ProductCoverage, ProductForm, ProductRecord } from '../../shared/domain';

export type ProductInput = Omit<
    ProductRecord,
    'id' | 'coverage' | 'casesRemaining' | 'dollarsApproved' | 'dollarsUsed' | 'dollarsRemaining'
> & { coverage?: ProductCoverage[] };
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
    if (input.coverage && input.coverage.some((coverage) => !['wic', 'medical'].includes(coverage))) {
        errors.push('Coverage must contain only wic or medical.');
    }
    if (input.unitPrice !== undefined && input.unitPrice !== null && Number(input.unitPrice) < 0) {
        errors.push('Unit price cannot be negative.');
    }
    if (input.poPrice !== undefined && input.poPrice !== null && Number(input.poPrice) < 0) {
        errors.push('PO price cannot be negative.');
    }

    return errors;
}

function normalizeProductInput(input: ProductInput): ProductInput {
    return {
        name: input.name.trim(),
        form: input.form.trim().toLowerCase().replace(/\s+/g, '-') as ProductForm,
        category: input.category,
        unitsPerCase: Number(input.unitsPerCase),
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
                product.name.toLowerCase() === input.name.trim().toLowerCase() ||
                product.productId === input.productId.trim() ||
                product.productCode === input.productCode.trim(),
        )
    ) {
        throw new Error('Product name, product ID, and product code must be unique.');
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

    const errors = validateProductInput(input);
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    const normalizedName = input.name.trim().toLowerCase();
    const normalizedProductId = input.productId.trim();
    if (
        products.some(
            (candidate) =>
                candidate.id !== id &&
                (candidate.name.toLowerCase() === normalizedName ||
                    candidate.productId === normalizedProductId ||
                    candidate.productCode === input.productCode.trim()),
        )
    ) {
        throw new Error('Product name, product ID, and product code must be unique.');
    }

    Object.assign(product, normalizeProductInput(input));
    return structuredClone(withQuantityTotals(product));
}

export function createProducts(inputs: ProductInput[]): ProductRecord[] {
    const errors = inputs.flatMap((input, index) =>
        validateProductInput(input).map((message) => `Row ${index + 2}: ${message}`),
    );
    const names = new Set(products.map((product) => product.name.toLowerCase()));
    const productIds = new Set(products.map((product) => product.productId));
    const productCodes = new Set(products.map((product) => product.productCode));
    for (const input of inputs) {
        const normalizedName = input.name.trim().toLowerCase();
        if (names.has(normalizedName)) {
            errors.push(`A product named "${input.name.trim()}" already exists.`);
        }
        if (productIds.has(input.productId.trim())) {
            errors.push(`A product with productId "${input.productId.trim()}" already exists.`);
        }
        if (productCodes.has(input.productCode.trim())) {
            errors.push(`A product with productCode "${input.productCode.trim()}" already exists.`);
        }
        names.add(normalizedName);
        productIds.add(input.productId.trim());
        productCodes.add(input.productCode.trim());
    }
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
