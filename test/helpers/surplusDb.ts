import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function surplusDb() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../../db/migrations/0006_surplus_inventory.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0007_surplus_notices.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0008_clinic_addresses.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0010_distributors.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../../db/migrations/0011_request_agency_transfers.sql', import.meta.url), 'utf8'));
    const statement = (sql: string, values: unknown[] = []) => ({
        bind: (...params: unknown[]) => statement(sql, params),
        first: async (column?: string) => {
            const r = sqlite.prepare(sql).get(...(values as never[])) as Record<string, unknown> | undefined;
            return column ? (r?.[column] ?? null) : (r ?? null);
        },
        all: async () => ({ results: sqlite.prepare(sql).all(...(values as never[])), success: true }),
        run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...(values as never[])) }),
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
