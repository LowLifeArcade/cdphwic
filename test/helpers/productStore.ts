import { ProductUploadError, type ProductUploadIssue } from '../../shared/productUploadErrors';
import { SEED_PRODUCTS } from '../../server/data/seed';
import type { ProductRecord } from '../../shared/domain';

import { validateProductInput, normalizeProductInput, withQuantityTotals, type ProductInput, type ProductQuantityUpdate } from '../../server/utils/productValidation';
export { validateProductInput, type ProductInput, type ProductQuantityUpdate } from '../../server/utils/productValidation';

// Legacy test fixture only. Production product reads and writes use the D1 repository.
const products = [...SEED_PRODUCTS];
let nextProductId = Math.max(...products.map((product) => product.id)) + 1;

export function listProducts(options: { includeInactive?: boolean } = {}): ProductRecord[] {
    return structuredClone(products.filter(product => options.includeInactive || product.active !== false).map(withQuantityTotals));
}

export function getProduct(id: number): ProductRecord {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) {
        throw new Error(`No product found with id ${id}.`);
    }
    return structuredClone(withQuantityTotals(product));
}

export function deleteProduct(id: number): ProductRecord {
    const product = products.find(candidate => candidate.id === id);
    if (!product) throw new Error(`No product found with id ${id}.`);
    // Retain snapshots used by older requests, but remove the item from active catalog selection.
    product.active = false;
    return structuredClone(withQuantityTotals(product));
}

export function createProduct(input: ProductInput, options: { allowBlanks?: boolean } = {}): ProductRecord {
    const errors = validateProductInput(input, options);
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    if (
        products.some(
            (product) =>
                product.active !== false && ((Boolean(input.productId.trim()) && product.productId === input.productId.trim()) ||
                (Boolean(input.productCode.trim()) && product.productCode === input.productCode.trim())),
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
    const metadataKeys = ['active', 'flavor', 'formulaDescription', 'manufacturer', 'mcKessonPo', 'mcKessonPrice', 'coveredByMediCal', 'fdaClass', 'wicClass', 'st', 'infantToddler', 'packaging', 'yield', 'genericFields'] as const;
    const metadata = Object.fromEntries(metadataKeys.map(key => [key, product[key]]));
    input = { ...metadata, ...input };
    const errors = validateProductInput(input, { allowBlanks: true });
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    const normalizedProductId = input.productId.trim();
    if (
        products.some(
            (candidate) =>
                candidate.id !== id && candidate.active !== false &&
                (candidate.productId === normalizedProductId ||
                    (Boolean(input.productCode.trim()) && candidate.productCode === input.productCode.trim())),
        )
    ) {
        throw new Error('Product ID and Product Number must be unique.');
    }

    Object.assign(product, normalizeProductInput(input));
    return structuredClone(withQuantityTotals(product));
}

export function createProducts(inputs: ProductInput[], options: { allowBlanks?: boolean } = {}): ProductRecord[] {
    const errors: ProductUploadIssue[] = inputs.flatMap((input, index) =>
        validateProductInput(input, options).map(message => ({ row: input.importRowNumber ?? index + 2, column: 'Product details', value: input.name ?? '', formulaName: input.name, message })),
    );
    const productIds = new Set(products.filter(product => product.active !== false).map((product) => product.productId));
    const productCodes = new Set(products.filter(product => product.active !== false).map((product) => product.productCode));
    inputs.forEach((input, index) => {
        const productId = String(input.productId ?? '').trim();
        const productCode = String(input.productCode ?? '').trim();
        const context = { row: input.importRowNumber ?? index + 2, formulaName: input.name };
        if (productId && productIds.has(productId) && !(productId === productCode && productCodes.has(productCode))) errors.push({ ...context, column: 'Product ID', value: productId, message: 'This Product ID already exists in the catalog or an earlier spreadsheet row. Use a unique ID.' });
        if (productCode && productCodes.has(productCode)) errors.push({ ...context, column: 'Product Number', value: productCode, message: 'This Product Number already exists in the catalog or an earlier spreadsheet row. Use a unique number or update the existing product.' });
        productIds.add(productId);
        productCodes.add(productCode);
    });
    if (errors.length) {
        throw new ProductUploadError(errors);
    }

    return inputs.map((input) => createProduct(input, options));
}

export function updateProducts(updates: ProductQuantityUpdate[]): ProductRecord[] {
    const updated: ProductRecord[] = [];
    for (const update of updates) {
        const product = products.find((candidate) => candidate.active !== false && candidate.productId === update.productId.trim());
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
