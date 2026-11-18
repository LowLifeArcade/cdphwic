import { it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { createError } from 'h3';
import { productDb } from './helpers/productDb';
import { createProduct, getProduct } from '../server/utils/productRepository';
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('readMultipartFormData', async (event: { file: Uint8Array }) => [{ name: 'file', data: event.file }]);
vi.stubGlobal('createError', createError);
const { default: update } = await import('../server/api/products/bulk-update.post');
function file(rows: unknown[][]) { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Products'); return XLSX.write(book, {type:'buffer',bookType:'xlsx'}); }
it('bulk updates new metadata in SQL and returns the database values consumed by the editor', async () => {
    const { db } = productDb();
    const product = await createProduct(db, { productId:'SQL-API',productCode:'000123',name:'Before',form:'powder',category:'standard',unitsPerCase:6,mcKessonPrice:15,manufacturer:'Maker' });
    const response = await update({ file: file([['Product Number','Formula Description','Manufacturer','McKesson Price','Covered by Medi-Cal','Packaging'], ['000123','Full updated description','Updated maker','','Yes','Carton']]),context:{cloudflare:{env:{CDPHWIC:db}}} } as never);
    expect(response.count).toBe(1);
    expect(await getProduct(db,product.id)).toMatchObject({ productCode:'000123',name:'Before',unitsPerCase:6,formulaDescription:'Full updated description',manufacturer:'Updated maker',mcKessonPrice:undefined,coveredByMediCal:true,coverage:['wic','medical'],packaging:'Carton' });
    expect(response.products[0]).toMatchObject(await getProduct(db,product.id));
});
it('rejects a bad update row without changing a valid earlier row', async () => {
    const { db } = productDb();
    const product = await createProduct(db, { productId:'KEEP',productCode:'KEEP',name:'Keep this',form:'powder',category:'standard',unitsPerCase:6 });
    await expect(update({ file:file([['Product Number','Formula Name'],['KEEP','Must not be saved'],['MISSING','Bad row']]),context:{cloudflare:{env:{CDPHWIC:db}}} } as never)).rejects.toMatchObject({statusCode:400,data:{issues:[{row:3,column:'Product Number'}]}});
    expect((await getProduct(db,product.id)).name).toBe('Keep this');
});
