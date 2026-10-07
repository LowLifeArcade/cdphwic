import { SEED_REQUESTS } from '../data/seed';
import type { RequestRecord, RequestScope, SessionUser } from '../../shared/domain';
import { filterRequestsByScope } from '../../shared/requestScope';

let nextRequestId = Math.max(...SEED_REQUESTS.map((request) => request.id)) + 1;
const requestStore = [...SEED_REQUESTS];

export function getRequestsForUser(
    user: SessionUser,
    scope: RequestScope = 'all',
    filters: { agencyId?: number; repId?: number } = {},
): RequestRecord[] {
    return filterRequestsByScope(requestStore, user, scope, filters);
}

export function getRequestById(id: number): RequestRecord | undefined {
    return requestStore.find((request) => request.id === id);
}

export function createRequestRecord(input: Omit<RequestRecord, 'id'>): RequestRecord {
    const record: RequestRecord = { ...input, id: nextRequestId++ };
    requestStore.unshift(record);
    return record;
}

export function updateRequestRecord(id: number, updates: Partial<RequestRecord>): RequestRecord | undefined {
    const index = requestStore.findIndex((request) => request.id === id);
    if (index < 0) {
        return undefined;
    }
    requestStore[index] = { ...requestStore[index], ...updates, id };
    return requestStore[index];
}

export function getAllRequests(): RequestRecord[] {
    return requestStore;
}
