import { describe, expect, it } from 'vitest';
import type { ProductRecord } from '../shared/domain';
import { matchingProducts, resolveProduct, selectAuthorizationProduct, enterAuthorizationProductNumber, authorizationCatalogProduct } from '../shared/productMatching';
import { catalogFormulaOptions, availableFormulaForms, findFormula } from '../shared/formulaCatalog';
import { validateFormulaEntry } from '../shared/formulaEntries';
import { requestFormulaUpdates, editableRequestFormulas } from '../shared/requestFormulaEditing';
const base: ProductRecord = { id: 9001, productId: '001', productCode: '001', name: 'Uploaded Formula', form: 'ready-to-feed', category: 'standard', unitsPerCase: 6, yield: 8, flavor: 'Vanilla', packaging: 'can', formulaDescription: 'A detailed can description', coverage: ['wic'] };
const products = [base, { ...base, id: 9002, productCode: '002', packaging: 'carton', unitsPerCase: 12 }, { ...base, id: 9003, productCode: '003', flavor: 'Chocolate' }];
const selection = { name: 'Uploaded Formula', form: 'ready-to-feed', flavor: 'Vanilla' };

describe('exact catalog product selection', () => {
    it('narrows by name, form, flavor, and packaging without arbitrary first matches', () => {
        expect(matchingProducts(products, { ...selection, name: ' uploaded formula ' })).toHaveLength(2);
        expect(resolveProduct(products, selection)).toBeUndefined();
        expect(resolveProduct(products, { ...selection, packaging: 'CAN' })?.productCode).toBe('001');
        expect(resolveProduct(products, { ...selection, form: 'powder' })).toBeUndefined();
    });
    it('requires an explicit product number to match the requested variant', () => {
        expect(resolveProduct(products, selection, '002')?.unitsPerCase).toBe(12);
        expect(resolveProduct(products, selection, '003')).toBeUndefined();
        expect(resolveProduct(products, selection, 'missing')).toBeUndefined();
        expect(resolveProduct(products.slice(0, 1), selection, 'missing')).toBeUndefined();
    });
    it('clears stale dependent fields and populates only an exact compatible staff selection', () => {
        const authorization = { productName: base.name, productForm: base.form, flavor: base.flavor, productCode: '001', unitsPerCase: 6, yield: 8, benefitIssuances: [] };
        expect(selectAuthorizationProduct(authorization, products, '002')).toMatchObject({ productCode: '002', unitsPerCase: 12, yield: 8 });
        const cleared = selectAuthorizationProduct(authorization, products, '');
        expect(cleared.productCode).toBe('');
        expect(cleared.unitsPerCase).toBeUndefined();
        expect(cleared.yield).toBeUndefined();
        expect(selectAuthorizationProduct(authorization, products, '003').productCode).toBe('');
        expect(authorization.productCode).toBe('001');
    });
    it('combines uploaded short names and forms without losing the built-in PDF metadata', () => {
        const options = catalogFormulaOptions([...products, { ...base, name: 'Fortini', form: 'powder' }]);
        expect(options.filter(item => item.name === 'Uploaded Formula')).toHaveLength(1);
        expect(findFormula('Uploaded Formula', products)?.hasFlavor).toBe(true);
        expect(availableFormulaForms('Uploaded Formula', products)).toEqual(['ready-to-feed']);
        expect(findFormula('Fortini', [{ ...base, name: 'Fortini', form: 'powder' }])).toMatchObject({ pdfField: 'Fortini', forms: ['ready-to-feed', 'powder'] });
        expect(options.some(item => item.name === base.formulaDescription)).toBe(false);
    });
    it('validates and round-trips uploaded formula names and flavors when editing requests', () => {
        const entry = { formulaName: base.name, otherFormulaName: '', productForm: base.form, formulaFlavor: 'Vanilla', ouncesPrescribed: 8, readyToFeedJustification: '' };
        expect(validateFormulaEntry(entry, products)).toBe('');
        const updates = requestFormulaUpdates({ durationMonths: 1 }, [entry], products);
        expect(updates.requestedFormulas?.[0]).toMatchObject({ productName: base.name, flavor: 'Vanilla', otherFormulaName: undefined });
        expect(updates.genericFields?.otherFormulaName).toBe('');
        expect(editableRequestFormulas(updates, products)[0]).toMatchObject({ formulaName: base.name, formulaFlavor: 'Vanilla', otherFormulaName: '' });
    });
});

it('uses imported flavor when inferring case size for surplus transfers', async () => {
    const { transferCatalogUnitsPerCase } = await import('../shared/requestTransfers');
    expect(transferCatalogUnitsPerCase({ formulaName: base.name, form: base.form, flavor: 'Chocolate' }, [base, { ...base, flavor: 'Chocolate', unitsPerCase: 12 }])).toBe(12);
});


it('keeps a cleared unique selection unresolved after serializing and reopening the request', async () => {
    const { formulaAuthorizations } = await import('../shared/formulaAuthorizations');
    const authorization = selectAuthorizationProduct({ productName: base.name, productForm: base.form, flavor: base.flavor, productCode: '001', unitsPerCase: 6, yield: 8, approvedCases: 2, standardCases: 1, specialOrderCases: 1, benefitIssuances: [] }, [base], '');
    const reopened = formulaAuthorizations(JSON.parse(JSON.stringify({ productName: base.name, productForm: base.form, formulaFlavor: base.flavor, formulaAuthorizations: [authorization] })))[0]!;
    expect(authorizationCatalogProduct([base], reopened)).toBeUndefined();
    expect(reopened.productCode).toBe('');
    expect(reopened.unitsPerCase).toBeUndefined();
    expect(reopened.yield).toBeUndefined();
    expect(reopened.standardCases).toBeUndefined();
    expect(reopened.specialOrderCases).toBeUndefined();
});
it('preserves manual details for products not in the catalog', () => {
    const authorization = { productName: 'Other formula', productForm: 'powder' as const, unitsPerCase: 6, yield: 12, benefitIssuances: [] };
    expect(enterAuthorizationProductNumber(authorization, products, 'CUSTOM-1')).toMatchObject({ productCode: 'CUSTOM-1', unitsPerCase: 6, yield: 12 });
});
