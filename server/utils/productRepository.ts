import type { ProductRecord } from '../../shared/domain';
import { ProductUploadError, type ProductUploadIssue } from '../../shared/productUploadErrors';
import { normalizeProductInput, validateProductInput, withQuantityTotals, type ProductInput } from './productValidation';
import type { ProductCatalogUpdate } from './productImport';

// Explicit, reviewed domain-to-SQL mapping. Never derive SQL column names from uploads.
const columns = {
    productId: 'product_id', productCode: 'product_code', name: 'name', form: 'form', category: 'category',
    unitsPerCase: 'units_per_case', yield: 'yield', flavor: 'flavor', formulaDescription: 'formula_description',
    manufacturer: 'manufacturer', mcKessonPo: 'mckesson_po', mcKessonPrice: 'mckesson_price',
    coveredByMediCal: 'covered_by_medi_cal', fdaClass: 'fda_class', wicClass: 'wic_class', st: 'st',
    infantToddler: 'infant_toddler', packaging: 'packaging', coverage: 'coverage', poPrice: 'po_price',
    unitPrice: 'unit_price', casesApproved: 'cases_approved', casesUsed: 'cases_used',
    supplierReference: 'supplier_reference', genericFields: 'generic_fields', active: 'active',
} as const;
const keys = Object.keys(columns) as Array<keyof typeof columns>;
type SqlProduct = Record<string, unknown> & { id: number; version: number };
const conflict = () => Object.assign(new Error('Product details changed during this update. Reload the catalog and try again.'), { statusCode: 409 });
function decode(row: SqlProduct): ProductRecord {
    const product: Record<string, unknown> = { id: Number(row.id) };
    for (const key of keys) {
        const value = row[columns[key]];
        if (key === 'coverage') product[key] = JSON.parse(String(value ?? '[]'));
        else if (key === 'genericFields') product[key] = value ? JSON.parse(String(value)) : undefined;
        else if (key === 'active') product[key] = value === 1;
        else if (key === 'coveredByMediCal') product[key] = value === null || value === undefined ? undefined : value === 1;
        else if (key === 'productCode') product[key] = value ?? '';
        else product[key] = value === null ? undefined : value;
    }
    return withQuantityTotals(product as unknown as ProductRecord);
}
function values(product: Omit<ProductRecord, 'id'>): unknown[] {
    return keys.map(key => {
        const value = product[key];
        if (key === 'coverage') return JSON.stringify(value ?? []);
        if (key === 'genericFields') return value ? JSON.stringify(value) : null;
        if (key === 'active') return value === false ? 0 : 1;
        if (key === 'coveredByMediCal') return value === undefined ? null : value ? 1 : 0;
        if (key === 'productCode') return value || null;
        return value ?? null;
    });
}
function normalized(input: ProductInput): Omit<ProductRecord, 'id'> {
    const product = normalizeProductInput(input);
    // Empty coverage is an explicit update, not a request to invent WIC coverage.
    if (input.coverage !== undefined) product.coverage = input.coverage;
    if (typeof input.coveredByMediCal === 'boolean') product.coverage = input.coveredByMediCal ? [...new Set([...product.coverage, 'medical' as const])] : product.coverage.filter(value => value !== 'medical');
    if (Object.hasOwn(input, 'poPrice') && input.poPrice === undefined) product.poPrice = undefined;
    return product;
}
function issue(input: Partial<ProductInput>, index: number, column: string, value: string, message: string): ProductUploadIssue {
    return { row: input.importRowNumber ?? index + 2, column, value, formulaName: input.name, message };
}
async function rawProduct(db: D1Database, id: number): Promise<SqlProduct> {
    const row = await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first<SqlProduct>();
    if (!row) throw Object.assign(new Error(`No product found with id ${id}.`), { statusCode: 404 });
    return row;
}
export async function listProducts(db: D1Database, options: { includeInactive?: boolean } = {}): Promise<ProductRecord[]> {
    const rows = await db.prepare(`SELECT * FROM products${options.includeInactive ? '' : ' WHERE active=1'} ORDER BY id`).all<SqlProduct>();
    return rows.results.map(decode);
}
export async function getProduct(db: D1Database, id: number): Promise<ProductRecord> { return decode(await rawProduct(db, id)); }

export async function createProducts(db: D1Database, inputs: ProductInput[], options: { allowBlanks?: boolean } = {}): Promise<ProductRecord[]> {
    if (!inputs.length) throw new Error('No products were provided.');
    const errors: ProductUploadIssue[] = inputs.flatMap((input, index) => validateProductInput(input, options).map(message => issue(input, index, 'Product details', input.name ?? '', message)));
    if (errors.length) throw new ProductUploadError(errors);
    const prepared = inputs.map(normalized);
    const active = await listProducts(db);
    const numbers = new Set(active.map(product => product.productCode).filter(Boolean));
    const ids = new Set(active.map(product => product.productId).filter(Boolean));
    prepared.forEach((product, index) => {
        if (product.active === false) return;
        if (product.productCode && numbers.has(product.productCode)) errors.push(issue(inputs[index]!, index, 'Product Number', product.productCode, 'This Product Number already exists in the catalog or an earlier spreadsheet row. Use a unique number or bulk update the existing product.'));
        if (product.productId && ids.has(product.productId) && !(product.productId === product.productCode && numbers.has(product.productCode))) errors.push(issue(inputs[index]!, index, 'Product ID', product.productId, 'This Product ID already exists. Use a unique ID.'));
        if (product.productCode) numbers.add(product.productCode);
        ids.add(product.productId);
    });
    if (errors.length) throw new ProductUploadError(errors);
    const sql = `INSERT INTO products(${keys.map(key => columns[key]).join(',')}) VALUES(${keys.map(() => '?').join(',')}) RETURNING *`;
    try {
        const results = await db.batch<SqlProduct>(prepared.map(product => db.prepare(sql).bind(...values(product))));
        return results.map(result => decode(result.results[0]!));
    } catch (error) {
        if (/UNIQUE constraint/i.test(String(error))) throw new Error('A Product Number or Product ID was added concurrently. Reload the catalog and retry. No products were added.');
        throw error;
    }
}
export async function createProduct(db: D1Database, input: ProductInput): Promise<ProductRecord> {
    return (await createProducts(db, [input], { allowBlanks: true }))[0]!;
}
function updateSteps(db: D1Database, row: SqlProduct, product: Omit<ProductRecord, 'id'>): D1PreparedStatement[] {
    return [
        db.prepare(`UPDATE products SET ${keys.map(key => `${columns[key]}=?`).join(',')},version=version+1 WHERE id=? AND version=? RETURNING *`).bind(...values(product), row.id, row.version),
        db.prepare('INSERT INTO product_write_guard(ok) SELECT CASE WHEN changes()=1 THEN 1 ELSE 0 END'),
    ];
}
async function writeUpdates(db: D1Database, updates: Array<{ row: SqlProduct; product: Omit<ProductRecord, 'id'> }>): Promise<ProductRecord[]> {
    try {
        const results = await db.batch<SqlProduct>([...updates.flatMap(update => updateSteps(db, update.row, update.product)), db.prepare('DELETE FROM product_write_guard')]);
        return updates.map((_, index) => decode(results[index * 2]!.results[0]!));
    } catch (error) {
        if (/CHECK constraint|UNIQUE constraint/i.test(String(error))) throw conflict();
        throw error;
    }
}
export async function updateProduct(db: D1Database, id: number, input: ProductInput): Promise<ProductRecord> {
    const row = await rawProduct(db, id);
    const combined = { ...decode(row), ...input };
    const errors = validateProductInput(combined, { allowBlanks: true });
    if (errors.length) throw new Error(errors.join(' '));
    return (await writeUpdates(db, [{ row, product: normalized(combined) }]))[0]!;
}
export async function deleteProduct(db: D1Database, id: number): Promise<ProductRecord> {
    const row = await rawProduct(db, id);
    return (await writeUpdates(db, [{ row, product: { ...decode(row), active: false } }]))[0]!;
}
export async function updateCatalogProducts(db: D1Database, changes: ProductCatalogUpdate[]): Promise<ProductRecord[]> {
    if (!changes.length) throw new Error('No product updates were provided.');
    const existing = await db.prepare('SELECT * FROM products WHERE active=1').all<SqlProduct>();
    const updates: Array<{ row: SqlProduct; product: Omit<ProductRecord, 'id'> }> = [];
    const errors: ProductUploadIssue[] = [];
    const seen = new Set<number>();
    for (const [index, change] of changes.entries()) {
        const matches = existing.results.filter(row => (!change.productCode || row.product_code === change.productCode) && (!change.productId || row.product_id === change.productId));
        const row = matches.length === 1 ? matches[0] : undefined;
        const context = { importRowNumber: change.importRowNumber };
        if (!row || (!change.productCode && !change.productId)) {
            errors.push(issue(context, index, change.productCode ? 'Product Number' : 'Product ID', change.productCode ?? change.productId ?? '', 'No active product matches these identifiers. Check the number or use bulk upload to add a new product.')); continue;
        }
        if (seen.has(row.id)) { errors.push(issue(context, index, 'Product Number', String(row.product_code ?? ''), 'The same product occurs more than once in this update file. Keep one update row per product.')); continue; }
        seen.add(row.id);
        const combined = { ...decode(row), ...change.changes };
        if (Object.hasOwn(change.changes, 'coverage') && !Object.hasOwn(change.changes, 'coveredByMediCal')) combined.coveredByMediCal = combined.coverage?.includes('medical') ?? false;
        const validation = validateProductInput(combined, { allowBlanks: true });
        errors.push(...validation.map(message => issue({ ...combined, ...context }, index, 'Product details', combined.name, message)));
        updates.push({ row, product: normalized(combined) });
    }
    if (errors.length) throw new ProductUploadError(errors);
    return writeUpdates(db, updates);
}
