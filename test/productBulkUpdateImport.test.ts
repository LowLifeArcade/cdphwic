import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseProductUpdateWorkbook } from '../server/utils/productImport';
function workbook(rows: unknown[][], type: 'xlsx' | 'csv' = 'xlsx') {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Products');
    return XLSX.write(book, { type: 'buffer', bookType: type });
}
describe('catalog update spreadsheet', () => {
    it.each(['xlsx', 'csv'] as const)('preserves identifiers and only changes supplied fields in %s', type => {
        expect(parseProductUpdateWorkbook(workbook([['Product Number', 'Formula Name', 'McKesson Price'], ['000123', 'New name', '$12.50']], type))).toEqual([{ productCode: '000123', importRowNumber: 2, changes: { name: 'New name', mcKessonPrice: 12.5 } }]);
    });
    it('clears supplied blanks without creating omitted fields', () => {
        const [row] = parseProductUpdateWorkbook(workbook([['productId', 'Yield', 'McKesson Price', 'Covered by Medi-Cal', 'Units Per Case', 'Flavor', 'Coverage'], ['001', '', '', '', '', '', '']]));
        expect(row?.changes).toEqual({ yield: null, mcKessonPrice: null, coveredByMediCal: null, unitsPerCase: undefined, flavor: '', coverage: [] });
        expect(Object.hasOwn(row!.changes, 'unitsPerCase')).toBe(true);
        expect(Object.hasOwn(row!.changes, 'category')).toBe(false);
    });
    it('accepts every human field and legacy extras', () => {
        const [row] = parseProductUpdateWorkbook(workbook([['Product Number', 'Formula Name', 'Formula Form', 'Flavor', 'Units Per Case', 'Yield', 'Formula Description', 'Manufacturer', 'McKesson PO', 'McKesson Price', 'Covered by Medi-Cal', 'FDA Class', 'WIC Class', 'S/T', 'Infant/Toddler', 'Packaging', 'Cases Approved', 'Cases Used', 'Unit Price', 'PO Price', 'Supplier Reference', 'Category', 'Coverage'], ['123', 'Name', 'Liquid Concentrate', 'Vanilla', 6, 8, 'Description', 'Maker', 'PO', 10, 'No', 'FDA', 'WIC', 'S', 'Toddler', 'Can', 20, 2, 3, 4, 'Ref', 'exempt', 'wic medical']]));
        expect(row?.changes).toEqual({ name: 'Name', form: 'concentrate', flavor: 'Vanilla', unitsPerCase: 6, yield: 8, formulaDescription: 'Description', manufacturer: 'Maker', mcKessonPo: 'PO', mcKessonPrice: 10, coveredByMediCal: false, fdaClass: 'FDA', wicClass: 'WIC', st: 'S', infantToddler: 'Toddler', packaging: 'Can', casesApproved: 20, casesUsed: 2, unitPrice: 3, poPrice: 4, supplierReference: 'Ref', category: 'exempt', coverage: ['wic', 'medical'] });
    });
    it('collects invalid cells and missing and duplicate selectors with actual row numbers', () => {
        let error: any;
        try { parseProductUpdateWorkbook(workbook([['Product Number', 'Units Per Case', 'Formula Form', 'Covered by Medi-Cal'], ['123', 'six', 'mystery', 'maybe'], [], ['', -2, 'Other', 'Yes'], ['123', 6, 'powder', 'No']])); } catch (failure) { error = failure; }
        expect(error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ cell: 'B2', value: 'six' }), expect.objectContaining({ cell: 'C2' }), expect.objectContaining({ cell: 'D2' }), expect.objectContaining({ cell: 'A4' }), expect.objectContaining({ cell: 'B4' }), expect.objectContaining({ cell: 'A5' })]));
    });
    it('rejects duplicate aliases and identifier-only uploads', () => {
        expect(() => parseProductUpdateWorkbook(workbook([['Product Number', 'Formula Name', 'name'], ['1', 'A', 'B']]))).toThrow('duplicates');
        expect(() => parseProductUpdateWorkbook(workbook([['Product Number'], ['1']]))).toThrow('editable');
    });
    it('preserves formatted numeric identifiers and rejects formula errors', () => {
        const book = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([['Product Number', 'Packaging'], [123, 'Can']]);
        sheet.A2.z = '000000';
        XLSX.utils.book_append_sheet(book, sheet, 'Products');
        expect(parseProductUpdateWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))[0]?.productCode).toBe('000123');
        sheet.B2 = { t: 'e', v: 7, w: '#DIV/0!' };
        expect(() => parseProductUpdateWorkbook(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))).toThrow('Excel');
    });
});
