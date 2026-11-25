import { addProductTables } from './productDb';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function surplusDb() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../../db/migrations/0006_surplus_inventory.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0007_surplus_notices.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0008_clinic_addresses.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0010_distributors.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0011_request_agency_transfers.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0012_transfer_shipping_labels.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0013_transfer_stock_confirmation.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0014_surplus_clinic_locations.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0015_surplus_movement_corrections.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0016_transfer_requested_label_count.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0017_request_surplus_allocations.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0021_surplus_packaging.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0022_transfer_availability_response.sql', import.meta.url), 'utf8'));
    addProductTables(sqlite);
    const statement = (sql: string, values: unknown[] = []) => ({
        bind: (...params: unknown[]) => statement(sql, params),
        first: async (column?: string) => {
            const r = sqlite.prepare(sql).get(...(values as never[])) as Record<string, unknown> | undefined;
            return column ? (r?.[column] ?? null) : (r ?? null);
        },
        all: async () => ({ results: sqlite.prepare(sql).all(...(values as never[])), success: true }),
        run: async () => {
            const query = sqlite.prepare(sql);
            if (/^\s*SELECT|RETURNING/i.test(sql)) return { success: true, results: query.all(...values as never[]), meta: {} };
            return { success: true, results: [], meta: query.run(...values as never[]) };
        },
        _sql: sql,
        _values: values,
    });
    const db = {
        prepare: (sql: string) => statement(sql),
        batch: async (items: ReturnType<typeof statement>[]) => {
            sqlite.exec('BEGIN IMMEDIATE');
            try {
                const out = [];
                for (const item of items) out.push(await item.run());
                sqlite.exec('COMMIT');
                return out;
            } catch (e) {
                sqlite.exec('ROLLBACK');
                throw e;
            }
        },
    } as unknown as D1Database;
    return { db, sqlite };
}
