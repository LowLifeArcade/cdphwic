import { expect, it } from 'vitest';
import { productDb, bindProductDb } from './helpers/productDb';
import { createProducts, listProducts, getProduct, updateProduct, deleteProduct, updateCatalogProducts } from '../server/utils/productRepository';
import { parseProductWorkbook, parseProductUpdateWorkbook } from '../server/utils/productImport';
import * as XLSX from 'xlsx';
const input = { unitPrice: 9, poPrice: 50, casesApproved: 20, casesUsed: 2, supplierReference: 'Supplier reference', genericFields: { source: 'spreadsheet' }, name: 'SQL Formula', productId: '000SQL', productCode: '000SQL', form: 'powder' as const, category: 'standard' as const, unitsPerCase: 6, yield: 8, flavor: 'Vanilla', formulaDescription: 'Description', packaging: 'Can', manufacturer: 'Maker', mcKessonPo: '000PO', mcKessonPrice: 12.5, coveredByMediCal: false, fdaClass: 'A', wicClass: 'B', st: 'S', infantToddler: 'Toddler', coverage: ['wic'] as const };
const editableInput = () => ({ ...input, coverage: ['wic' as const] });
function workbook(rows: unknown[][]) { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Products'); return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }); }
it('writes every field to its named SQL column and reads it through a separate database binding', async () => {
    const { db, sqlite } = productDb();
    const [created] = await createProducts(db, [editableInput()], { allowBlanks: true });
    expect(sqlite.prepare('SELECT product_code,formula_description,manufacturer,mckesson_po,mckesson_price,covered_by_medi_cal,fda_class,wic_class,st,infant_toddler,packaging,yield,units_per_case,flavor,unit_price,po_price,cases_approved,cases_used,supplier_reference,generic_fields,coverage FROM products').get()).toMatchObject({ unit_price: 9, po_price: 50, cases_approved: 20, cases_used: 2, supplier_reference: 'Supplier reference', generic_fields: '{"source":"spreadsheet"}', coverage: '["wic"]', product_code: '000SQL', formula_description: 'Description', manufacturer: 'Maker', mckesson_po: '000PO', mckesson_price: 12.5, covered_by_medi_cal: 0, fda_class: 'A', wic_class: 'B', st: 'S', infant_toddler: 'Toddler', packaging: 'Can', yield: 8, units_per_case: 6, flavor: 'Vanilla' });
    expect(await getProduct(bindProductDb(sqlite), created!.id)).toMatchObject(input);
    expect(await listProducts(bindProductDb(sqlite))).toHaveLength(1);
});
it('imports partial rows without inventing numbers and persists cleared optional fields', async () => {
    const { db, sqlite } = productDb();
    const rows = parseProductWorkbook(workbook([['Formula Name', 'Formula Form', 'Flavor', 'Product Number', 'Units Per Case', 'Yield'], ['Partial SQL', 'Other', '', '', '', '']]));
    const [created] = await createProducts(db, rows, { allowBlanks: true });
    expect(await getProduct(db, created!.id)).toMatchObject({ productCode: '', form: 'other', unitsPerCase: undefined, yield: undefined });
    expect(sqlite.prepare('SELECT units_per_case,product_code FROM products').get()).toMatchObject({ units_per_case: null, product_code: null });
    await updateProduct(db, created!.id, { ...rows[0]!, yield: 4, mcKessonPrice: 20, coveredByMediCal: true });
    await updateProduct(db, created!.id, { ...rows[0]!, yield: null, mcKessonPrice: null, coveredByMediCal: null });
    expect(await getProduct(db, created!.id)).toMatchObject({ yield: undefined, mcKessonPrice: undefined, coveredByMediCal: undefined });
});
it('bulk updates metadata by Product Number while preserving omitted fields and rejecting a whole invalid batch', async () => {
    const { db } = productDb();
    const [created] = await createProducts(db, [editableInput()], { allowBlanks: true });
    const updates = parseProductUpdateWorkbook(workbook([['Product Number', 'Manufacturer', 'McKesson Price', 'Covered by Medi-Cal', 'Yield'], ['000SQL', 'Updated maker', '', 'Yes', 10]]));
    await updateCatalogProducts(db, updates);
    expect(await getProduct(db, created!.id)).toMatchObject({ manufacturer: 'Updated maker', mcKessonPrice: undefined, coveredByMediCal: true, yield: 10, unitsPerCase: 6, packaging: 'Can' });
    await expect(updateCatalogProducts(db, [{ productCode: '000SQL', importRowNumber: 2, changes: { manufacturer: 'Must roll back' } }, { productCode: 'MISSING', importRowNumber: 3, changes: { manufacturer: 'Missing' } }])).rejects.toThrow('Row 3');
    expect((await getProduct(db, created!.id)).manufacturer).toBe('Updated maker');
});
it('keeps active Product Numbers unique, rolls back duplicate batches, and preserves delete history', async () => {
    const { db } = productDb();
    await expect(createProducts(db, [editableInput(), editableInput()], { allowBlanks: true })).rejects.toThrow('Product Number');
    expect(await listProducts(db)).toHaveLength(0);
    const [created] = await createProducts(db, [editableInput()], { allowBlanks: true });
    await deleteProduct(db, created!.id);
    expect(await listProducts(db)).toHaveLength(0);
    expect(await getProduct(db, created!.id)).toMatchObject({ active: false, unitsPerCase: 6 });
    expect((await createProducts(db, [editableInput()], { allowBlanks: true }))[0]!.id).not.toBe(created!.id);
});

it('synchronizes Medi-Cal flags and coverage during partial updates and really clears included blank prices', async () => {
    const { db } = productDb();
    const [product] = await createProducts(db, [{ ...editableInput(), unitPrice: 10, poPrice: 20 }], { allowBlanks: true });
    await updateCatalogProducts(db, [{ productCode: '000SQL', importRowNumber: 2, changes: { coveredByMediCal: true, poPrice: undefined } }]);
    expect(await getProduct(db, product!.id)).toMatchObject({ coveredByMediCal: true, coverage: ['wic', 'medical'], poPrice: undefined, unitPrice: 10 });
    await updateCatalogProducts(db, [{ productCode: '000SQL', importRowNumber: 2, changes: { coverage: ['wic'] } }]);
    expect(await getProduct(db, product!.id)).toMatchObject({ coveredByMediCal: false, coverage: ['wic'] });
});
it('rejects a stale database write instead of overwriting a concurrent product edit', async () => {
    const { db, sqlite } = productDb();
    const [product] = await createProducts(db, [editableInput()], { allowBlanks: true });
    const racingDb = { prepare: db.prepare.bind(db), batch: async (statements: D1PreparedStatement[]) => {
        sqlite.prepare('UPDATE products SET manufacturer=?,version=version+1 WHERE id=?').run('Concurrent edit', product!.id);
        return db.batch(statements);
    } } as D1Database;
    await expect(updateProduct(racingDb, product!.id, { ...editableInput(), manufacturer: 'Stale edit' })).rejects.toMatchObject({ statusCode: 409 });
    expect((await getProduct(db, product!.id)).manufacturer).toBe('Concurrent edit');
    expect(sqlite.prepare('SELECT * FROM product_write_guard').all()).toEqual([]);
});

it('has no in-memory fallback when the D1 binding is missing', async () => {
    const { productDatabase } = await import('../server/utils/productDatabase');
    expect(() => productDatabase({ context: {} } as never)).toThrow('D1 binding');
});
