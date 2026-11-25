import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { ensureSurplusLot } from '../server/utils/surplusStore';
import { surplusDb } from './helpers/surplusDb';

vi.mock('h3', async (importOriginal) => {
    const actual = await importOriginal<typeof import('h3')>();
    return {
        ...actual,
        defineEventHandler: (handler: unknown) => handler,
        getHeader: (event: any) => event.identity,
        getQuery: (event: any) => event.query ?? {},
        createError: (details: any) => Object.assign(new Error(details.statusMessage), details),
    };
});

const { default: getDispositions } = await import('../server/api/surplus/dispositions.get');
const { default: getDispositionsCsv } = await import('../server/api/surplus/dispositions.csv.get');

function event(db: D1Database, identity: string, query: Record<string, unknown> = {}) {
    return {
        identity,
        query,
        headers: {} as Record<string, string>,
        context: { cloudflare: { env: { CDPHWIC: db, PRESCRIPTIONS: {}, ENV: 'dev' } } },
    };
}

async function addDisposal(db: D1Database, lotId: string, id: string, actorId: number, date: string, staff = 'Staff') {
    const operationId = `op-${id}`;
    await db.prepare('INSERT INTO surplus_commands(id,actor_id,payload,status) VALUES(?,?,?,?)')
        .bind(operationId, actorId, JSON.stringify({ kind: 'deduct', reason: 'Donation' }), 'completed').run();
    await db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units)
        VALUES(?,?,?,'deduct',3,?,?,0,0,0)`)
        .bind(id, operationId, lotId, actorId, JSON.stringify({ reason: 'Donation', staff, date })).run();
}

async function addCorrection(db: D1Database, lotId: string, originalId: string, id: string, correctedQuantity: number) {
    const operationId = `op-${id}`;
    await db.prepare('INSERT INTO surplus_commands(id,actor_id,payload,status) VALUES(?,?,?,?)')
        .bind(operationId, 2, JSON.stringify({ kind: 'correct-entry' }), 'completed').run();
    await db.prepare(`INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,reason,on_hand,reserved,expired_units,corrects_movement_id,corrected_quantity)
        VALUES(?,?,?,'correct-entry',1,2,'{}',0,0,0,?,?)`)
        .bind(id, operationId, lotId, originalId, correctedQuantity).run();
}

afterEach(() => vi.unstubAllGlobals());

describe('surplus disposal report routes', () => {
    it('limits agency JSON results to its own agency and permits reviewer cross-agency access', async () => {
        const { db } = surplusDb();
        const own = await ensureSurplusLot(db, 10, { formulaName: 'Own', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        const other = await ensureSurplusLot(db, 11, { formulaName: 'Other', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, own.id, 'own', 2, '2026-10-01');
        await addDisposal(db, other.id, 'other', 3, '2026-10-01');

        expect((await getDispositions(event(db, 'agency', { agencyId: '11' }) as never)).map((row: any) => row.formula_name)).toEqual(['Own']);
        expect((await getDispositions(event(db, 'admin') as never)).map((row: any) => row.formula_name).sort()).toEqual(['Other', 'Own']);
        expect((await getDispositions(event(db, 'internal') as never)).map((row: any) => row.formula_name).sort()).toEqual(['Other', 'Own']);
    });

    it('rejects invalid and reversed date ranges', async () => {
        const { db } = surplusDb();
        await expect(getDispositions(event(db, 'agency', { from: '2026-02-30' }) as never)).rejects.toMatchObject({ statusCode: 400 });
        await expect(getDispositions(event(db, 'agency', { from: '2026-10-02', to: '2026-10-01' }) as never)).rejects.toMatchObject({ statusCode: 400 });
        await expect(getDispositions(event(db, 'agency', { from: ['2026-10-01'] }) as never)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('uses the selected event dates for JSON and matching CSV output', async () => {
        const { db } = surplusDb();
        const lot = await ensureSurplusLot(db, 10, { formulaName: 'Filtered Formula', form: 'powder', flavor: '', expirationDate: '2026-12-31' });
        await addDisposal(db, lot.id, 'in-range', 2, '2026-10-01', '=HYPERLINK("https://evil.invalid","click")');
        await addDisposal(db, lot.id, 'out-of-range', 2, '2026-09-30');
        await addCorrection(db, lot.id, 'in-range', 'correction-one', 2);
        await addCorrection(db, lot.id, 'in-range', 'correction-two', 1);
        vi.stubGlobal('setHeader', (routeEvent: any, key: string, value: string) => { routeEvent.headers[key] = value; });
        const routeEvent = event(db, 'agency', { from: '2026-10-01', to: '2026-10-31' });

        const json = await getDispositions(routeEvent as never);
        const csv = await getDispositionsCsv(routeEvent as never);

        expect(json).toHaveLength(1);
        expect(json[0]).toMatchObject({ id: 'in-range', quantity: 1, original_quantity: 3, corrected: true });
        const workbook = XLSX.read(String(csv), { type: 'string' });
        const csvRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets[workbook.SheetNames[0]!]!, { defval: '', raw: true });
        expect(csvRows).toHaveLength(1);
        expect(csvRows[0]).toMatchObject({
            Activity: 'Donation',
            Quantity: 1,
            Formula: 'Filtered Formula',
            'Staff Attesting': "'=HYPERLINK(\"https://evil.invalid\",\"click\")",
            Agency: 'Mendocino County',
            Clinic: 'Not specified',
            'Recorded By': 'Maria Lopez',
            'Original Quantity': 3,
            Corrected: 'Yes',
        });
        expect(csvRows[0]?.['Event Date']).toBeTypeOf('number');
        expect(routeEvent.headers).toMatchObject({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="surplus-disposals.csv"',
        });
    });
});
