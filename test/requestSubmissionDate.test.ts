import { submissionDateOnly } from '../shared/requestPresentation';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { updateSubmittedRequest } from '../server/utils/submittedRequests';
import type { RequestRecord } from '../shared/domain';

it('backfills original submission dates and preserves them through review', async () => {
    const { db, sqlite } = surplusDb();
    const insert = sqlite.prepare('INSERT INTO surplus_submissions(id,agency_id,request_json,payload,actor_id,created_at) VALUES(?,?,?,?,?,?)');
    insert.run('original', 10, JSON.stringify({id:1001,agencyId:10,submissionId:'original',status:'unopened'}), '{}', 100, '2026-12-31 23:59:00');
    insert.run('dated', 10, JSON.stringify({submissionDate:'2026-11-01'}), '{}', 100, '2026-12-31 23:59:00');
    insert.run('legacy', 10, '{}', 'legacy', 0, '2026-12-31 23:59:00');
    sqlite.exec(readFileSync(new URL('../db/migrations/0009_request_submission_dates.sql', import.meta.url),'utf8'));
    const read = async (id:string) => JSON.parse((await db.prepare('SELECT request_json FROM surplus_submissions WHERE id=?').bind(id).first<string>('request_json'))!);
    const previous = await read('original');
    expect(previous.submissionDate).toBe('2026-12-31T23:59:00Z');
    expect((await read('dated')).submissionDate).toBe('2026-11-01');
    expect((await read('legacy')).submissionDate).toBeUndefined();
    const updated = await updateSubmittedRequest(db,previous as RequestRecord,{status:'opened',submissionDate:'2027-01-01'});
    expect(updated.submissionDate).toBe('2026-12-31T23:59:00Z');
});

it('displays submission timestamps in the local agency Pacific calendar date', () => {
    expect(submissionDateOnly('2026-10-28T01:00:00Z')).toBe('2026-10-27');
    expect(submissionDateOnly('2026-10-03')).toBe('2026-10-03');
});
