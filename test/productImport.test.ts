import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseProductWorkbook } from '../server/utils/productImport';
import { createProducts, listProducts } from './helpers/productStore';

const headers = ['Formula Name', 'Formula Form', 'Flavor', 'Product Number', 'Units Per Case', 'Yield'];
function workbook(rows: unknown[][], type: 'xlsx' | 'csv' = 'xlsx') {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Products');
    return XLSX.write(book, { type: 'buffer', bookType: type });
}

describe('product spreadsheet import', () => {
    it.each(['xlsx', 'csv'] as const)('maps spreadsheet headers and preserves all metadata from %s', (type) => {
        const [row] = parseProductWorkbook(workbook([
            [...headers, 'Formula Description', 'Manufacturer', 'McKesson PO', 'McKesson Price', 'Covered by Medi-Cal', 'FDA Class', 'WIC Category', 'S/T', 'Infant/Toddler', 'Packaging'],
            ['Example', 'Ready to Feed', 'Vanilla', '001234', 6, 8, 'Example Vanilla 8 oz carton', 'Maker', '000PO', '$123.45', 'Yes', 'Exempt', 'Class A', 'S', 'Toddler', '8 oz carton'],
        ], type));
        expect(row).toMatchObject({ name: 'Example', form: 'ready-to-feed', flavor: 'Vanilla', productCode: '001234', productId: '001234', unitsPerCase: 6, yield: 8, formulaDescription: 'Example Vanilla 8 oz carton', manufacturer: 'Maker', mcKessonPo: '000PO', mcKessonPrice: 123.45, coveredByMediCal: true, fdaClass: 'Exempt', wicClass: 'Class A', st: 'S', infantToddler: 'Toddler', packaging: '8 oz carton' });
    });
    it('preserves Excel number formatting for product numbers without treating formatted quantities as text', () => {
        const book = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([headers, ['Example', 'Powder', '', 123, 6, 8]]);
        sheet.D2.z = '000000';
        XLSX.utils.book_append_sheet(book, sheet, 'Products');
        expect(parseProductWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))[0]).toMatchObject({ productCode: '000123', unitsPerCase: 6 });
    });
    it('allows blank flavor and optional metadata without inventing prices or coverage', () => {
        const row = parseProductWorkbook(workbook([headers, ['Example', 'powder', '', '1234', 6, 8]]))[0];
        expect(row?.flavor).toBeUndefined();
        expect(row?.mcKessonPrice).toBeUndefined();
        expect(row?.coveredByMediCal).toBeUndefined();
    });
    it('accepts legacy internal headers', () => {
        expect(parseProductWorkbook(workbook([['productId', 'productCode', 'name', 'form', 'category', 'unitsPerCase', 'coverage'], ['LEGACY', '00055', 'Legacy', 'powder', 'exempt', 12, 'wic medical']]))[0]).toMatchObject({ productId: 'LEGACY', productCode: '00055', category: 'exempt', coverage: ['wic', 'medical'] });
    });
    it('rejects missing headers, empty files, and invalid rows with useful row numbers', () => {
        expect(() => parseProductWorkbook(workbook([headers.slice(0, 5), ['Example', 'powder', '', '123', 6]]))).toThrow('Yield');
        expect(() => parseProductWorkbook(workbook([headers]))).toThrow('No products');
        expect(() => parseProductWorkbook(workbook([headers, ['Example', 'powder', '', '123', 'six', 8]]))).toThrow('Row 2');
        expect(() => parseProductWorkbook(workbook([[...headers, 'McKesson Price'], ['Example', 'powder', '', '123', 6, 8, '-$2']]))).toThrow('McKesson Price');
        expect(() => parseProductWorkbook(workbook([[...headers, 'Covered by Medi-Cal'], ['Example', 'powder', '', '123', 6, 8, 'maybe']]))).toThrow('Covered by Medi-Cal');
    });
    it('creates distinct products sharing a name and retains metadata through the store', () => {
        const rows = parseProductWorkbook(workbook([[...headers, 'Packaging', 'Formula Description'], ['Bulk Shared', 'powder', '', 'BULK-01', 6, 8, 'can', 'Bulk shared can'], ['Bulk Shared', 'powder', '', 'BULK-02', 12, 8, 'carton', 'Bulk shared carton']]));
        expect(createProducts(rows)).toMatchObject([{ productCode: 'BULK-01', packaging: 'can', formulaDescription: 'Bulk shared can' }, { productCode: 'BULK-02', packaging: 'carton' }]);
    });
    it('rejects duplicate product numbers atomically', () => {
        const before = listProducts().length;
        const rows = parseProductWorkbook(workbook([headers, ['Duplicate A', 'powder', '', 'DUP-01', 6, 8], ['Duplicate B', 'powder', '', 'DUP-01', 12, 8]]));
        expect(() => createProducts(rows)).toThrow('Product Number');
        expect(listProducts()).toHaveLength(before);
    });
});

it.each(['$', '1,5', 'NaN', 'Infinity'])('rejects malformed prices: %s', price => {
    expect(() => parseProductWorkbook(workbook([[...headers, 'McKesson Price'], ['Bad price', 'powder', '', 'BAD-PRICE', 6, 8, price]]))).toThrow('Row 2');
});
it('rejects invalid legacy quantity values', () => {
    expect(() => parseProductWorkbook(workbook([['productId', 'productCode', 'name', 'form', 'category', 'unitsPerCase', 'casesApproved'], ['BAD-QTY', 'BAD-QTY', 'Bad qty', 'powder', 'standard', 6, 'abc']]))).toThrow('Row 2');
});

it.each(['csv', 'xlsx'] as const)('keeps leading-zero product IDs distinct in bulk quantity updates from %s', async type => {
    const { parseProductQuantityWorkbook } = await import('../server/utils/productImport');
    const { updateProducts } = await import('./helpers/productStore');
    const suffix = type === 'csv' ? '91' : '92';
    createProducts([{ productId: `00090${suffix}`, productCode: `00090${suffix}`, name: `Zero ID ${type}`, form: 'powder', category: 'standard', unitsPerCase: 6 }, { productId: `90${suffix}`, productCode: `90${suffix}`, name: `Plain ID ${type}`, form: 'powder', category: 'standard', unitsPerCase: 6 }]);
    const updates = parseProductQuantityWorkbook(workbook([['productId', 'casesApproved', 'casesUsed'], [`00090${suffix}`, 20, 1]], type));
    expect(updateProducts(updates)[0]).toMatchObject({ productId: `00090${suffix}`, casesApproved: 20 });
    expect(listProducts().find(product => product.productId === `90${suffix}`)?.casesApproved).toBe(0);
});
it('reports the actual worksheet row for duplicates after blank rows', () => {
    const rows = parseProductWorkbook(workbook([headers, ['First', 'powder', '', 'BLANK-DUP', 6, 8], [], ['Second', 'powder', '', 'BLANK-DUP', 6, 8]]));
    expect(() => createProducts(rows)).toThrow('Row 4');
});

it('accepts Other and blank Formula Form and blank cells throughout partially populated rows', () => {
    const rows = parseProductWorkbook(workbook([headers, ['Blank fields', '', '', '', '', ''], ['', 'Other', '', '', '', ''], ['Named Other', 'Other', '', 'BLANK-OTHER', '', '']]));
    const saved = createProducts(rows, { allowBlanks: true });
    expect(saved).toHaveLength(3);
    expect(saved[0]).toMatchObject({ name: 'Blank fields', form: '', productCode: '' });
    expect(saved[0]?.unitsPerCase).toBeUndefined();
    expect(saved[0]?.yield).toBeUndefined();
    expect(saved[1]).toMatchObject({ name: '', form: 'other', productCode: '' });
    expect(saved[0]?.productId).not.toBe(saved[1]?.productId);
});
it('collects actionable row, column, cell and raw value details for every invalid row', () => {
    const rows = [headers, ['First', 'Mystery form', '', 'ERR-A', 6, 8], ['Second', 'powder', '', 'ERR-B', 'six', 8]];
    let failure: unknown;
    try { parseProductWorkbook(workbook(rows)); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ issues: [
        { row: 2, column: 'Formula Form', cell: 'B2', value: 'Mystery form', formulaName: 'First', message: expect.stringContaining('Other') },
        { row: 3, column: 'Units Per Case', cell: 'E3', value: 'six', formulaName: 'Second', message: expect.stringContaining('number') },
    ] });
});
it('continues ignoring wholly empty rows and rejects populated invalid numbers', () => {
    expect(parseProductWorkbook(workbook([headers, [], ['Name only', '', '', '', '', '']]))).toHaveLength(1);
    expect(() => parseProductWorkbook(workbook([headers, ['Bad number', 'Other', '', '', -1, '']]))).toThrow('Units Per Case');
});

it('identifies missing and duplicate spreadsheet headers without falling back to internal names', () => {
    let missing: unknown;
    let duplicate: unknown;
    try { parseProductWorkbook(workbook([headers.slice(1), ['Other', '', 'HEADERS', 6, 8]])); } catch (error) { missing = error; }
    try { parseProductWorkbook(workbook([[...headers, 'Formula Form'], ['Example', 'powder', '', 'HEADERS', 6, 8, 'powder']])); } catch (error) { duplicate = error; }
    expect(missing).toMatchObject({ issues: [{ row: 1, column: 'Formula Name', message: expect.stringContaining('header') }] });
    expect((missing as { issues: unknown[] }).issues).toHaveLength(1);
    expect(duplicate).toMatchObject({ issues: [{ row: 1, column: 'Formula Form', cell: 'G1', value: 'Formula Form', message: expect.stringContaining('B1') }] });
});
it.each(['D2', 'E2'])('reports Excel formula errors instead of importing numeric error codes in %s', address => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ['Excel error', 'Other', '', 'EXCEL-ERROR', 6, 8]]);
    sheet[address] = { t: 'e', v: 7, w: '#DIV/0!' };
    XLSX.utils.book_append_sheet(book, sheet, 'Products');
    let error: unknown;
    try { parseProductWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })); } catch (failure) { error = failure; }
    expect(error).toMatchObject({ issues: [{ cell: address, value: '#DIV/0!', message: expect.stringContaining('Excel') }] });
});
