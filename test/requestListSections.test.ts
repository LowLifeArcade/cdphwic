import {expect, it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {filterAndSortRequests, requestsInSection} from '../shared/requestListFilters';

const request = (id: number, status: RequestRecord['status']) => ({id, status, participantName: `Participant ${id}`, submissionDate: '2026-11-23'}) as RequestRecord;

it('separates only complete requests from the active workload', () => {
    const rows = [request(1, 'incomplete'), request(2, 'shipped'), request(3, 'complete'), request(4, 'denied')];
    expect(requestsInSection(rows, 'active').map(row => row.id)).toEqual([1, 2, 4]);
    expect(requestsInSection(rows, 'completed').map(row => row.id)).toEqual([3]);
    expect(requestsInSection([], 'completed')).toEqual([]);
});

it('moves requests between sections when completed or reopened without altering records', () => {
    const row = request(1, 'shipped');
    row.status = 'complete';
    expect(requestsInSection([row], 'active')).toEqual([]);
    expect(requestsInSection([row], 'completed')).toEqual([row]);
    row.status = 'opened';
    expect(requestsInSection([row], 'active')).toEqual([row]);
    expect(requestsInSection([row], 'completed')).toEqual([]);
});

it('applies existing tag filters and sorting within a section', () => {
    const rows = [request(2, 'complete'), {...request(1, 'complete'), requestKind: 'extension' as const}, request(3, 'opened')];
    expect(filterAndSortRequests(requestsInSection(rows, 'completed'), 'all', 'extension', 'participant').map(row => row.id)).toEqual([1]);
    expect(filterAndSortRequests(requestsInSection(rows, 'completed'), 'all', 'all', 'participant').map(row => row.id)).toEqual([1, 2]);
});

it('includes every status in All and retains filtering and sorting', () => {
    const rows = [request(2, 'complete'), request(1, 'opened')];
    expect(requestsInSection(rows, 'all')).toEqual(rows);
    expect(filterAndSortRequests(requestsInSection(rows, 'all'), 'all', 'all', 'participant').map(row => row.id)).toEqual([1, 2]);
    expect(requestsInSection([], 'all')).toEqual([]);
});
