import { productDb } from './helpers/productDb';
import { expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { createError } from 'h3';
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('readMultipartFormData', async (event: { file: Uint8Array }) => [{ name: 'file', data: event.file }]);
vi.stubGlobal('createError', createError);
const { default: upload } = await import('../server/api/products/bulk.post');
function file(rows: unknown[][]) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Catalog');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
const database = productDb().db;
async function uploadFile(event: {file: Uint8Array}) { return upload({...event,context:{cloudflare:{env:{CDPHWIC:database}}}} as never); }
const headers = ['Formula Name', 'Formula Form', 'Flavor', 'Product Number', 'Units Per Case', 'Yield'];
it('transports all cell errors in the JSON body instead of HTTP status text', async () => {
    let failure: unknown;
    try { await uploadFile({ file: file([headers, ['First', 'Bad form', '', 'ERR-1', 6, 8], ['Second', 'powder', '', 'ERR-2', 'six', 8]]) } as never); } catch (error) { failure = error; }
    const response = (failure as ReturnType<typeof createError>).toJSON();
    expect(response.statusCode).toBe(400);
    expect(response.statusMessage).toBe('Product upload needs corrections.');
    expect(response.data).toMatchObject({ message: expect.stringContaining('No products were added'), issues: [{ row: 2, cell: 'B2', column: 'Formula Form', value: 'Bad form' }, { row: 3, cell: 'E3', column: 'Units Per Case', value: 'six' }] });
});
it('uses relaxed validation through the actual upload route for incomplete rows', async () => {
    const response = await uploadFile({ file: file([headers, ['Incomplete upload route', 'Other', '', '', '', '']]) } as never);
    expect(response).toMatchObject({ count: 1, products: [{ name: 'Incomplete upload route', form: 'other', productCode: '' }] });
    expect(response.products[0]?.unitsPerCase).toBeUndefined();
});

it('reports duplicate Product Numbers with a single spreadsheet-facing issue and leaves the batch unchanged', async () => {
    const { listProducts } = await import('../server/utils/productRepository');
    const before = (await listProducts(database)).length;
    let failure: unknown;
    try { await uploadFile({ file: file([headers, ['One', 'Other', '', 'ERR-DUPLICATE', '', ''], ['Two', '', '', 'ERR-DUPLICATE', '', '']]) } as never); } catch (error) { failure = error; }
    expect((failure as ReturnType<typeof createError>).data.issues).toMatchObject([{ row: 3, column: 'Product Number', value: 'ERR-DUPLICATE', formulaName: 'Two' }]);
    expect((failure as ReturnType<typeof createError>).data.issues).toHaveLength(1);
    expect(await listProducts(database)).toHaveLength(before);
});
