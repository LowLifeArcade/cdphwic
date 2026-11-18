import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { SEED_PRODUCTS } from '../../server/data/seed';

export function productDb(seed = false) {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys=ON');
    const directory = new URL('../../db/migrations/', import.meta.url);
    for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
    if (seed) seedProductFixtures(sqlite);
    return { sqlite, db: bindProductDb(sqlite) };
}
export function bindProductDb(sqlite: DatabaseSync): D1Database {
    const statement = (sql: string, values: unknown[] = []) => ({
        bind: (...params: unknown[]) => statement(sql, params),
        first: async (column?: string) => {
            const row = sqlite.prepare(sql).get(...values as never[]) as Record<string, unknown> | undefined;
            return column ? row?.[column] ?? null : row ?? null;
        },
        all: async () => ({ results: sqlite.prepare(sql).all(...values as never[]), success: true }),
        run: async () => {
            const query = sqlite.prepare(sql);
            if (/^\s*(?:SELECT|PRAGMA)|RETURNING/i.test(sql)) return { results: query.all(...values as never[]), success: true, meta: {} };
            const result = query.run(...values as never[]);
            return { results: [], success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
    });
    return { prepare: statement, batch: async (steps: ReturnType<typeof statement>[]) => {
        sqlite.exec('BEGIN IMMEDIATE');
        try { const results = []; for (const step of steps) results.push(await step.run()); sqlite.exec('COMMIT'); return results; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    } } as unknown as D1Database;
}

export function seedProductFixtures(sqlite: DatabaseSync) {
    for (const product of SEED_PRODUCTS) sqlite.prepare('INSERT INTO products(id,product_id,product_code,name,form,category,units_per_case,active,coverage,yield,unit_price,po_price,cases_approved,cases_used) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(product.id, product.productId, product.productCode || null, product.name, product.form, product.category, product.unitsPerCase ?? null, product.active === false ? 0 : 1, JSON.stringify(product.coverage), product.yield ?? null, product.unitPrice ?? null, product.poPrice ?? null, product.casesApproved ?? 0, product.casesUsed ?? 0);
}

export function addProductTables(sqlite: DatabaseSync) {
    const base = readFileSync(new URL('../../db/migrations/0001_initial_schema.sql', import.meta.url), 'utf8').match(/CREATE TABLE IF NOT EXISTS products \([\s\S]*?\);/)?.[0];
    if (!base) throw new Error('Missing product schema');
    sqlite.exec(base);
    for (const file of ['0003_product_accounting_fields.sql', '0018_product_catalog_metadata.sql', '0019_product_catalog_persistence.sql']) sqlite.exec(readFileSync(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8'));
    seedProductFixtures(sqlite);
}
