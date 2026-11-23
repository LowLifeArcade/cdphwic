import { describe, expect, it } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { getDemoUser } from '../server/utils/session';
import { ensureSubmittedRequest, submittedRequest, submittedRequests, updateSubmittedRequest } from '../server/utils/submittedRequests';
import type { RequestRecord } from '../shared/domain';

const record = (id = 9001): RequestRecord => ({ id, agencyId: 10, agencyMemberId: 100, participantName: 'Synthetic', productName: 'Fortini', status: 'unopened', submissionDate: '2026-11-01' });

describe('persisted request compatibility', () => {
    it('preserves immutable ownership and identity while advancing revision and opened date', async () => {
        const { db } = surplusDb();
        const previous = await ensureSubmittedRequest(db, record());
        const next = await updateSubmittedRequest(db, previous, { id: 1, submissionId: 'other', submissionDate: '2000-01-01', agencyId: 11, agencyMemberId: 2, revision: 99, status: 'opened' });
        expect(next).toMatchObject({ id: previous.id, submissionId: previous.submissionId, submissionDate: previous.submissionDate, agencyId: 10, agencyMemberId: 100, revision: 1, status: 'opened' });
        expect(next.openedAt).toBeTruthy();
        const again = await updateSubmittedRequest(db, next, { nextSteps: 'New instruction' });
        expect(again.openedAt).toBe(next.openedAt);
        expect(again.revision).toBe(2);
    });
    it('rejects stale writes and rolls back later batch statements', async () => {
        const { db, sqlite } = surplusDb();
        const previous = await ensureSubmittedRequest(db, record());
        const next = await updateSubmittedRequest(db, previous, { nextSteps: 'Winner' });
        await expect(updateSubmittedRequest(db, previous, { nextSteps: 'Stale' })).rejects.toMatchObject({ statusCode: 409 });
        expect(await submittedRequest(db, previous.id, getDemoUser('admin'))).toEqual(next);
        expect(sqlite.prepare('SELECT count(*) AS count FROM surplus_guard').get()).toEqual({ count: 0 });
    });
    it('blocks unopened-only edits after opening and retains the latest record', async () => {
        const { db } = surplusDb();
        const previous = await ensureSubmittedRequest(db, record());
        const opened = await updateSubmittedRequest(db, previous, { status: 'opened' });
        await expect(updateSubmittedRequest(db, opened, { nextSteps: 'Forbidden' }, true)).rejects.toMatchObject({ statusCode: 409 });
        expect(await submittedRequest(db, previous.id, getDemoUser('admin'))).toEqual(opened);
    });
    it('scopes reads to an agency and keeps staff visibility across agencies', async () => {
        const { db } = surplusDb();
        await ensureSubmittedRequest(db, record());
        await ensureSubmittedRequest(db, { ...record(9002), agencyId: 11 });
        expect((await submittedRequests(db, getDemoUser('agency'))).map(row => row.id)).toEqual([9001]);
        expect(await submittedRequest(db, 9002, getDemoUser('agency'))).toBeUndefined();
        expect(await submittedRequests(db, getDemoUser('internal'))).toHaveLength(2);
        expect(await submittedRequests(db, getDemoUser('admin'))).toHaveLength(2);
    });
});

it('exposes focused workflow modules through the compatible public facade', async () => {
    const persistence = await import('../server/features/requests/persistence');
    const shipments = await import('../server/features/requests/shipments');
    expect(persistence.ensureSubmittedRequest).toBe(ensureSubmittedRequest);
    expect(shipments.updateSubmittedRequest).toBe(updateSubmittedRequest);
});

it('rolls back the request and preceding side effects if a later inventory-batch statement fails', async () => {
    const { nextRecord, writeRecord } = await import('../server/features/requests/persistence');
    const { db, sqlite } = surplusDb();
    const previous = await ensureSubmittedRequest(db, record());
    const steps = [
        db.prepare('INSERT INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)').bind('atomic-side-effect', 1),
        db.prepare('INSERT INTO surplus_guard(ok) VALUES(0)'),
    ];
    await expect(writeRecord(db, previous, nextRecord(previous, { nextSteps: 'Must roll back' }), false, steps)).rejects.toMatchObject({ statusCode: 409 });
    expect(await submittedRequest(db, previous.id, getDemoUser('admin'))).toEqual(previous);
    expect(sqlite.prepare('SELECT count(*) AS count FROM surplus_notice_reads').get()).toEqual({ count: 0 });
    expect(sqlite.prepare('SELECT count(*) AS count FROM surplus_guard').get()).toEqual({ count: 0 });
});
