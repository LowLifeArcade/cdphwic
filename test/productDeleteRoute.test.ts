import { productDb } from './helpers/productDb';
import { expect, it, vi } from 'vitest';
import { createProduct, getProduct, listProducts } from '../server/utils/productRepository';
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('getRouterParam', (event: { id: string }) => event.id);
vi.stubGlobal('getHeader', (event: { identity: string }) => event.identity);
vi.stubGlobal('createError', (details: object) => Object.assign(new Error(), details));
const { default: remove } = await import('../server/api/products/[id].delete');
const database = productDb().db;
async function callRemove(event: object) { return remove({...event,context:{cloudflare:{env:{CDPHWIC:database}}}} as never); }
it('allows reviewers to delete a product and preserves the historical record', async () => {
    const product = await createProduct(database, { productId: 'DELETE-ROUTE', productCode: 'DELETE-ROUTE', name: 'Delete route test', form: 'powder', category: 'standard', unitsPerCase: 6 });
    await expect(callRemove({ id: String(product.id), identity: 'agency' } as never)).rejects.toMatchObject({ statusCode: 403 });
    expect((await listProducts(database)).some(row => row.id === product.id)).toBe(true);
    await expect(callRemove({ id: String(product.id), identity: 'internal' } as never)).resolves.toMatchObject({ product: { id: product.id, active: false } });
    expect((await getProduct(database,product.id)).unitsPerCase).toBe(6);
    expect((await listProducts(database)).some(row => row.id === product.id)).toBe(false);
});
it('rejects invalid and missing product IDs without deleting another product', async () => {
    await expect(callRemove({ id: 'invalid', identity: 'admin' } as never)).rejects.toMatchObject({ statusCode: 400 });
    await expect(callRemove({ id: '999999999', identity: 'admin' } as never)).rejects.toMatchObject({ statusCode: 404 });
});
