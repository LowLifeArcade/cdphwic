import * as XLSX from 'xlsx';
import { validateProductInput, type ProductInput, type ProductQuantityUpdate } from './productStore';
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
    const modern = headers.some(header => header.toLowerCase() === 'formula name');
    const required = modern ? requiredHeaders : ['productId', 'productCode', 'name', 'form', 'category', 'unitsPerCase'];
    const missing = required.filter(header => !headers.some(value => value.toLowerCase() === header.toLowerCase()));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
    const keys = headers.map(header => mappedHeaders[header.toLowerCase() as keyof typeof mappedHeaders] ?? header);
    if (new Set(keys.filter(Boolean)).size !== keys.filter(Boolean).length) throw new Error('Duplicate spreadsheet columns are not allowed.');
    const products: ProductInput[] = [];
    const errors: string[] = [];
    for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex++) {
        const row: Record<string, unknown> = { importRowNumber: rowIndex + 1 };
        let populated = false;
        keys.forEach((key, index) => {
            if (!key) return;
            const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + index })];
            const text = clean(cell?.v);
            if (text) populated = true;
            if (numericFields.has(key)) {
                row[key] = numericValue(cell?.v, headers[index]!, rowIndex + 1);
            } else {
                row[key] = cell?.t === 'n' ? XLSX.utils.format_cell(cell).trim() : text;
            }
        });
        if (!populated) continue;
        if (modern) {
            row.productId = row.productCode;
            row.category = 'standard';
        }
        row.flavor = clean(row.flavor) || undefined;
        row.form = clean(row.form).toLowerCase().replace(/[\s_]+/g, '-');
        if (row.form === 'rtf') row.form = 'ready-to-feed';
        if (row.form === 'liquid-concentrate') row.form = 'concentrate';
        const coverage = clean(row.coverage).toLowerCase().split(/[\s,]+/).filter(Boolean) as ProductCoverage[];
        row.coverage = coverage.length ? coverage : undefined;
        const covered = clean(row.coveredByMediCal).toLowerCase();
        if (covered && !['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(covered)) {
            errors.push(`Row ${rowIndex + 1}: Covered by Medi-Cal must be yes or no.`);
        }
        row.coveredByMediCal = covered ? ['yes', 'y', 'true', '1'].includes(covered) : undefined;
        if (row.coveredByMediCal === true && !coverage.includes('medical')) row.coverage = [...(coverage.length ? coverage : ['wic']), 'medical'];
        const input = row as unknown as ProductInput;
        errors.push(...validateProductInput(input).map(error => `Row ${rowIndex + 1}: ${error}`));
        products.push(input);
    }
    if (errors.length) throw new Error(errors.join('\n'));
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
