import type { ProductRecord } from './domain';
import type { FormulaAuthorization } from './formulaAuthorizations';

export interface ProductSelection { name: string; form?: string; flavor?: string; packaging?: string }
const normalize = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Normalize catalog naming conventions without merging strengths or clinical variants.
function formulaNameKey(value?: string): string {
    return normalize(value).replace(/\bstd\b/g, 'standard').replace(/\bjr\b/g, 'junior')
        .replace(/\bpaediatric\b/g, 'pediatric').replace(/\bcal(?:ories?)?\b/g, '')
        .replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function compatibleVariant(product: ProductRecord, selection: ProductSelection): boolean {
    return (!selection.form || !product.form || product.form === 'other' || normalize(product.form) === normalize(selection.form))
        && (!selection.flavor || normalize(product.flavor ?? product.genericFields?.flavor) === normalize(selection.flavor))
        && (!selection.packaging || normalize(product.packaging) === normalize(selection.packaging));
}
// Suggestions can include a broader formula family; automatic resolution stays exact.
export function candidateProducts(products: ProductRecord[], selection: ProductSelection): ProductRecord[] {
    const requested = formulaNameKey(selection.name);
    if (!requested) return [];
    const requestedTokens = requested.split(' ');
    return products.filter(product => {
        // Suggestions also consult descriptions: imported flavor metadata can be incomplete.
        // Keep this broader comparison separate from automatic exact resolution.
        const flavor = formulaNameKey(selection.flavor);
        const description = formulaNameKey(product.formulaDescription);
        const flavorMatches = !flavor || [product.flavor, product.genericFields?.flavor].some(value => formulaNameKey(value) === flavor)
            || (` ${description} `).includes(` ${flavor} `);
        if (!flavorMatches || !compatibleVariant(product, {...selection, flavor: undefined})) return false;
        const names = [product.name, product.formulaDescription];
        // A flavor written in the formula name must also participate in matching.
        const variant = [product.flavor, product.genericFields?.flavor].filter(Boolean).join(' ');
        return names.some(value => {
            const candidate = formulaNameKey(`${value ?? ''} ${variant}`).split(' ');
            let position = 0;
            for (const token of candidate) {
                if (token === requestedTokens[position]) position++;
            }
            return position === requestedTokens.length;
        });
    });
}

export function matchingProducts(products: ProductRecord[], selection: ProductSelection): ProductRecord[] {
    if (!normalize(selection.name)) return [];
    return products.filter(product => formulaNameKey(product.name) === formulaNameKey(selection.name)
        && compatibleVariant(product, selection));
}

export function resolveProduct(products: ProductRecord[], selection: ProductSelection, productCode?: string): ProductRecord | undefined {
    const candidates = matchingProducts(products, selection);
    if (productCode !== undefined) return productCode.trim() ? candidates.find(product => product.productCode === productCode.trim()) : undefined;
    const product = candidates.length === 1 ? candidates[0] : undefined;
    return product?.productCode.trim() && product.form && product.form !== 'other' ? product : undefined;
}

function catalogProductByNumber(products: ProductRecord[], code: string): ProductRecord | undefined {
    const matches = products.filter(product => code.trim() && product.productCode.trim() === code.trim());
    return matches.length === 1 ? matches[0] : undefined;
}
function populateAuthorizationProduct(authorization: FormulaAuthorization, product?: ProductRecord): FormulaAuthorization {
    return { ...authorization, formulaName: product?.name ?? authorization.formulaName, flavor: product?.flavor || authorization.flavor, productCode: product?.productCode ?? '', unitsPerCase: product?.unitsPerCase, yield: product?.yield,
        approvedCases: undefined, standardCases: undefined, specialOrderCases: undefined };
}
export function selectAuthorizationProduct(authorization: FormulaAuthorization, products: ProductRecord[], productCode: string): FormulaAuthorization {
    const product = productCode ? resolveProduct(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor }, productCode) : undefined;
    return populateAuthorizationProduct(authorization, product);
}

export function authorizationCatalogProduct(products: ProductRecord[], authorization: Pick<FormulaAuthorization, 'productName' | 'productForm' | 'flavor' | 'productCode'>): ProductRecord | undefined {
    // An empty code is a deliberate cleared selection; undefined is an older, never-resolved record.
    if (authorization.productCode !== undefined) return catalogProductByNumber(products, authorization.productCode);
    return resolveProduct(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor });
}

export function enterAuthorizationProductNumber(authorization: FormulaAuthorization, products: ProductRecord[], productCode: string): FormulaAuthorization {
    const code = productCode.trim();
    if (!code) return selectAuthorizationProduct(authorization, products, '');
    const product = catalogProductByNumber(products, code);
    if (product) return populateAuthorizationProduct(authorization, product);
    const candidates = matchingProducts(products, { name: authorization.productName, form: authorization.productForm, flavor: authorization.flavor });
    if (!candidates.some(product => product.productCode.trim())) return { ...authorization, productCode: code };
    return { ...selectAuthorizationProduct(authorization, products, ''), productCode: code };
}
