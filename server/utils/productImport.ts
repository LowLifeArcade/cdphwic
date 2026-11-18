import { ProductUploadError, type ProductUploadIssue } from '../../shared/productUploadErrors';
import * as XLSX from 'xlsx';
import { validateProductInput, type ProductInput, type ProductQuantityUpdate } from './productValidation';
import type { ProductCoverage } from '../../shared/domain';

const mappedHeaders = {
    'formula name': 'name', 'formula form': 'form', flavor: 'flavor',
    'product number': 'productCode', 'units per case': 'unitsPerCase', yield: 'yield',
    'formula description': 'formulaDescription', manufacturer: 'manufacturer',
    'mckesson po': 'mcKessonPo', 'mckesson price': 'mcKessonPrice',
    'covered by medi-cal': 'coveredByMediCal', 'fda class': 'fdaClass',
    'wic class': 'wicClass', 's/t': 'st', 'infant/toddler': 'infantToddler', packaging: 'packaging',
} as const;
const numericFields = new Set(['unitsPerCase', 'yield', 'mcKessonPrice', 'unitPrice', 'poPrice', 'casesApproved', 'casesUsed']);
const requiredHeaders = ['Formula Name', 'Formula Form', 'Flavor', 'Product Number', 'Units Per Case', 'Yield'];
const clean = (value: unknown) => String(value ?? '').trim();

function readProductSheet(data: Uint8Array) {
    // Keep CSV values as text and use formatted Excel cells for identifiers such as 000123.
    const workbook = XLSX.read(data, { type: 'array', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet || !sheet['!ref']) throw new Error('No products found in the first worksheet.');
    return { sheet, range: XLSX.utils.decode_range(sheet['!ref']) };
}

function numericValue(value: unknown, field: string, row: number): number | undefined {
    const text = clean(value);
    if (!text) return undefined;
    const token = text.replace(/^([+-]?)\$/, '$1');
    if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error(`Row ${row}: ${field} must be a valid number.`);
    const number = Number(token.replaceAll(',', ''));
    if (!Number.isFinite(number)) throw new Error(`Row ${row}: ${field} must be a finite number.`);
    return number;
}

export function parseProductWorkbook(data: Uint8Array): ProductInput[] {
    const { sheet, range } = readProductSheet(data);
    const headers: string[] = [];
    for (let column = range.s.c; column <= range.e.c; column++) {
        headers.push(clean(sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })]?.v));
    }
    const modern = headers.some(header => requiredHeaders.filter(name => !['Flavor', 'Yield'].includes(name)).some(name => header.toLowerCase() === name.toLowerCase()));
    const required = modern ? requiredHeaders : ['productId', 'productCode', 'name', 'form', 'category', 'unitsPerCase'];
    const missing = required.filter(header => !headers.some(value => value.toLowerCase() === header.toLowerCase()));
    if (missing.length) throw new ProductUploadError(missing.map(column => ({ row: range.s.r + 1, column, value: '', message: 'Add this column header to the first worksheet. Cell values may be blank.' })));
    const keys = headers.map(header => mappedHeaders[header.toLowerCase() as keyof typeof mappedHeaders] ?? header);
    const duplicates: ProductUploadIssue[] = [];
    keys.forEach((key, index) => {
        const first = keys.indexOf(key);
        if (key && first !== index) duplicates.push({ row: range.s.r + 1, column: headers[index]!, cell: XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index }), value: headers[index]!, message: `This column duplicates ${XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + first })}. Keep one column with this header and remove the duplicate.` });
    });
    if (duplicates.length) throw new ProductUploadError(duplicates);
    const products: ProductInput[] = [];
    const errors: ProductUploadIssue[] = [];
    for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex++) {
        const row: Record<string, unknown> = { importRowNumber: rowIndex + 1 };
        const raw: Record<string, string> = {};
        const invalid = new Set<string>();
        const issue = (key: string, message: string) => {
            const column = keys.indexOf(key);
            errors.push({ row: rowIndex + 1, column: headers[column] ?? key, cell: column < 0 ? undefined : XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + column }), value: raw[key] ?? '', formulaName: raw.name || undefined, message });
        };
        // Capture all raw values first, including the name when it occurs after an invalid cell.
        keys.forEach((key, index) => { const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + index })]; raw[key] = cell?.t === 'n' || cell?.t === 'e' ? XLSX.utils.format_cell(cell).trim() : clean(cell?.v); });
        let populated = false;
        keys.forEach((key, index) => {
            if (!key) return;
            const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + index })];
            const text = clean(cell?.v);
            if (text) populated = true;
            if (cell?.t === 'e') {
                invalid.add(key);
                issue(key, 'Fix the Excel formula error, replace it with a valid value, or leave this cell blank.');
                return;
            }
            if (numericFields.has(key)) {
                try { row[key] = numericValue(cell?.v, headers[index]!, rowIndex + 1); }
                catch { invalid.add(key); issue(key, 'Enter a valid number, such as 12 or 12.5, or leave this cell blank.'); }
            } else {
                row[key] = cell?.t === 'n' ? XLSX.utils.format_cell(cell).trim() : text;
            }
        });
        if (!populated) continue;
        if (modern) {
            row.productId = row.productCode || `IMPORT-${crypto.randomUUID()}`;
            row.category = 'standard';
        }
        row.productId = clean(row.productId) || `IMPORT-${crypto.randomUUID()}`;
        row.productCode = clean(row.productCode);
        row.name = clean(row.name);
        row.category = clean(row.category) || 'standard';
        row.flavor = clean(row.flavor) || undefined;
        row.form = clean(row.form).toLowerCase().replace(/[\s_]+/g, '-');
        if (row.form === 'rtf') row.form = 'ready-to-feed';
        if (row.form === 'liquid-concentrate') row.form = 'concentrate';
        const coverage = clean(row.coverage).toLowerCase().split(/[\s,]+/).filter(Boolean) as ProductCoverage[];
        row.coverage = coverage.length ? coverage : undefined;
        const covered = clean(row.coveredByMediCal).toLowerCase();
        if (covered && !['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(covered)) {
            issue('coveredByMediCal', 'Enter Yes or No, or leave this cell blank.');
        }
        row.coveredByMediCal = covered ? ['yes', 'y', 'true', '1'].includes(covered) : undefined;
        if (row.coveredByMediCal === true && !coverage.includes('medical')) row.coverage = [...(coverage.length ? coverage : ['wic']), 'medical'];
        const input = row as unknown as ProductInput;
        const fields = [
            ['Form ', 'form', 'Choose Powder, Liquid Concentrate, Ready-to-Feed (RTF), or Other, or leave this cell blank.'],
            ['Units per case', 'unitsPerCase', 'Enter a positive number, or leave this cell blank.'],
            ['Yield', 'yield', 'Enter a nonnegative number of fluid ounces, or leave this cell blank.'],
            ['McKesson Price', 'mcKessonPrice', 'Enter a nonnegative price, or leave this cell blank.'],
            ['Category', 'category', 'Choose standard, exempt, or nutritional, or leave this cell blank.'],
            ['Coverage', 'coverage', 'Use wic or medical, or leave this cell blank.'],
            ['Unit price', 'unitPrice', 'Enter a nonnegative price, or leave this cell blank.'],
            ['PO price', 'poPrice', 'Enter a nonnegative price, or leave this cell blank.'],
            ['Cases approved', 'casesApproved', 'Enter a whole, nonnegative number, or leave this cell blank.'],
            ['Cases used', 'casesUsed', 'Enter a whole, nonnegative number, or leave this cell blank.'],
        ];
        for (const error of validateProductInput(input, { allowBlanks: true })) {
            const field = fields.find(([prefix]) => error.startsWith(prefix!));
            if (field && !invalid.has(field[1]!)) issue(field[1]!, field[2]!);
        }
        products.push(input);
    }
    if (errors.length) throw new ProductUploadError(errors);
    if (!products.length) throw new Error('No products found in the first worksheet.');
    return products;
}


export function parseProductQuantityWorkbook(data: Uint8Array): ProductQuantityUpdate[] {
    const { sheet, range } = readProductSheet(data);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
    const updates = rows.map((row, index) => {
        const productId = clean(row.productId);
        const casesApproved = numericValue(row.casesApproved, 'casesApproved', range.s.r + index + 2);
        const casesUsed = numericValue(row.casesUsed, 'casesUsed', range.s.r + index + 2);
        if (!productId || !Number.isSafeInteger(casesApproved) || casesApproved! < 0 || !Number.isSafeInteger(casesUsed) || casesUsed! < 0 || casesUsed! > casesApproved!) throw new Error(`Row ${range.s.r + index + 2}: Provide Product ID and valid whole case quantities.`);
        return { productId, casesApproved: casesApproved!, casesUsed: casesUsed! };
    });
    if (!updates.length) throw new Error('No products found in the first worksheet.');
    return updates;
}

export interface ProductCatalogUpdate {
    productCode?: string;
    productId?: string;
    changes: Partial<ProductInput>;
    importRowNumber: number;
}

export function parseProductUpdateWorkbook(data: Uint8Array): ProductCatalogUpdate[] {
    const { sheet, range } = readProductSheet(data);
    const aliases: Record<string, string> = { ...mappedHeaders, 'cases approved': 'casesApproved', 'cases used': 'casesUsed', 'unit price': 'unitPrice', 'po price': 'poPrice', 'supplier reference': 'supplierReference' };
    const editable = ['name','form','flavor','unitsPerCase','yield','formulaDescription','manufacturer','mcKessonPo','mcKessonPrice','coveredByMediCal','fdaClass','wicClass','st','infantToddler','packaging','casesApproved','casesUsed','unitPrice','poPrice','supplierReference','category','coverage'];
    for (const key of [...editable, 'productId', 'productCode']) aliases[key.toLowerCase()] = key;
    const headers: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) headers.push(clean(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v));
    const keys = headers.map(header => aliases[header.toLowerCase()] ?? '');
    const issues: ProductUploadIssue[] = [];
    keys.forEach((key, index) => {
        if (key && keys.indexOf(key) !== index) issues.push({ row: range.s.r + 1, column: headers[index]!, cell: XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index }), value: headers[index]!, message: `This column duplicates ${XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + keys.indexOf(key) })}. Keep one copy.` });
    });
    if (!keys.includes('productCode') && !keys.includes('productId')) issues.push({ row: range.s.r + 1, column: 'Product Number', value: '', message: 'Add Product Number (or legacy productId) so each row identifies an existing product.' });
    if (!keys.some(key => editable.includes(key))) issues.push({ row: range.s.r + 1, column: 'Editable columns', value: '', message: 'Include at least one editable product column, such as Formula Name or Packaging.' });
    if (issues.length) throw new ProductUploadError(issues);
    const updates: ProductCatalogUpdate[] = [];
    const selectors = new Set<string>();
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const cells = headers.map((_, index) => sheet[XLSX.utils.encode_cell({ r, c: range.s.c + index })]);
        const texts = cells.map(cell => cell ? XLSX.utils.format_cell(cell).trim() : '');
        if (!texts.some(Boolean)) continue;
        const change: Record<string, unknown> = {};
        const row: ProductCatalogUpdate = { changes: change as Partial<ProductInput>, importRowNumber: r + 1 };
        const invalid = new Set<string>();
        const report = (index: number, message: string) => issues.push({ row: r + 1, column: headers[index] ?? 'Product Number', cell: XLSX.utils.encode_cell({ r, c: range.s.c + Math.max(0, index) }), value: texts[index] ?? '', formulaName: texts[keys.indexOf('name')] || undefined, message });
        keys.forEach((key, index) => {
            if (!key) return;
            const text = texts[index]!;
            const cell = cells[index];
            if (cell?.t === 'e') { invalid.add(key); report(index, 'Fix the Excel formula error or leave this cell blank.'); return; }
            if (key === 'productCode' || key === 'productId') { if (text) row[key] = text; return; }
            if (numericFields.has(key)) {
                try { const value = numericValue(cell?.v, headers[index]!, r + 1); change[key] = value ?? (['yield','mcKessonPrice'].includes(key) ? null : undefined); }
                catch { invalid.add(key); report(index, 'Enter a valid number or leave this cell blank.'); }
            } else if (key === 'coveredByMediCal') {
                const value = text.toLowerCase();
                if (!value) change[key] = null;
                else if (['yes','y','true','1','no','n','false','0'].includes(value)) change[key] = ['yes','y','true','1'].includes(value);
                else { invalid.add(key); report(index, 'Use Yes, No, or blank.'); }
            } else if (key === 'form') {
                let value = text.toLowerCase().replace(/[\s_]+/g, '-');
                if (value === 'rtf') value = 'ready-to-feed';
                if (value === 'liquid-concentrate') value = 'concentrate';
                change[key] = value;
            } else if (key === 'coverage') change[key] = text.toLowerCase().split(/[\s,]+/).filter(Boolean);
            else if (key === 'category') change[key] = text.toLowerCase() || 'standard';
            else change[key] = text;
        });
        const selectorIndex = keys.includes('productCode') ? keys.indexOf('productCode') : keys.indexOf('productId');
        if (!row.productCode && !row.productId && !invalid.has(keys[selectorIndex]!)) report(selectorIndex, 'Enter the existing Product Number or Product ID. An update cannot identify a product from a blank identifier.');
        const selector = row.productCode ? `number:${row.productCode}` : row.productId ? `id:${row.productId}` : '';
        if (selector && selectors.has(selector)) report(selectorIndex, 'This product occurs more than once in the spreadsheet. Keep one update row per product.');
        if (selector) selectors.add(selector);
        const messages = validateProductInput({ productId: '_update', productCode: '_update', name: '', form: '', category: 'standard', ...change } as Partial<ProductInput>, { allowBlanks: true });
        const fields: Record<string, string> = { 'Form': 'form', 'Units per case': 'unitsPerCase', 'Yield': 'yield', 'McKesson Price': 'mcKessonPrice', 'Covered by Medi-Cal': 'coveredByMediCal', 'Category': 'category', 'Coverage': 'coverage', 'Unit price': 'unitPrice', 'PO price': 'poPrice', 'Cases approved': 'casesApproved', 'Cases used': 'casesUsed' };
        for (const message of messages) {
            const prefix = Object.keys(fields).find(prefix => message.startsWith(prefix));
            const key = prefix ? fields[prefix]! : '';
            if (key && !invalid.has(key)) report(keys.indexOf(key), `${message} Correct this cell or leave it blank.`);
        }
        updates.push(row);
    }
    if (issues.length) throw new ProductUploadError(issues);
    if (!updates.length) throw new Error('No product updates found in the first worksheet.');
    return updates;
}
