import type { ProductRecord } from './domain';
import type { FormulaAuthorization } from './formulaAuthorizations';

export interface ProductSelection { name: string; form?: string; flavor?: string; packaging?: string }
const normalize = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function matchingProducts(products: ProductRecord[], selection: ProductSelection): ProductRecord[] {
    if (!normalize(selection.name)) return [];
    return products.filter(product => normalize(product.name) === normalize(selection.name)
        && (!selection.form || !product.form || product.form === 'other' || normalize(product.form) === normalize(selection.form))
        && (!selection.flavor || normalize(product.flavor ?? product.genericFields?.flavor) === normalize(selection.flavor))
        && (!selection.packaging || normalize(product.packaging) === normalize(selection.packaging)));
}

export function resolveProduct(products: ProductRecord[], selection: ProductSelection, productCode?: string): ProductRecord | undefined {
    const candidates = matchingProducts(products, selection);
    if (productCode !== undefined) return productCode.trim() ? candidates.find(product => product.productCode === productCode.trim()) : undefined;
    const product = candidates.length === 1 ? candidates[0] : undefined;
    return product?.productCode.trim() && product.form && product.form !== 'other' ? product : undefined;
}

export function selectAuthorizationProduct(authorization: FormulaAuthorization, products: ProductRecord[], productCode: string): FormulaAuthorization {
    const product = productCode ? resolveProduct(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor }, productCode) : undefined;
    return { ...authorization, productCode: product?.productCode ?? '', unitsPerCase: product?.unitsPerCase, yield: product?.yield,
        approvedCases: undefined, standardCases: undefined, specialOrderCases: undefined };
}

export function authorizationCatalogProduct(products: ProductRecord[], authorization: Pick<FormulaAuthorization, 'productName' | 'productForm' | 'flavor' | 'productCode'>): ProductRecord | undefined {
    // An empty code is a deliberate cleared selection; undefined is an older, never-resolved record.
    return resolveProduct(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor }, authorization.productCode);
}

export function enterAuthorizationProductNumber(authorization: FormulaAuthorization, products: ProductRecord[], productCode: string): FormulaAuthorization {
    const code = productCode.trim();
    if (!code) return selectAuthorizationProduct(authorization, products, '');
    if (authorizationCatalogProduct(products, { ...authorization, productCode: code })) return selectAuthorizationProduct(authorization, products, code);
    const candidates = matchingProducts(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor });
    if (!candidates.some(product => product.productCode.trim())) return { ...authorization, productCode: code };
    return { ...selectAuthorizationProduct(authorization, products, ''), productCode: code };
}
