import { describe, expect, it } from 'vitest';
import { createRequestRecord, deleteRequestRecord, getAllRequests, updateRequestRecord } from '../server/utils/requestStore';
import { canSelectShippedStatus } from '../shared/requestOperations';

describe('request shipping history', () => {
    it('keeps shipped available after changing status and reopening the request', () => {
        const request = createRequestRecord({
            ...getAllRequests()[0],
            status: 'opened',
            shippedAt: undefined,
            eta: '2026-10-20',
            trackingNumbers: [{ number: '123', carrier: 'ups' }],
        });
        try {
            expect(canSelectShippedStatus(request)).toBe(false);
            const shipped = updateRequestRecord(request.id, { status: 'shipped' })!;
            expect(shipped.shippedAt).toBeTruthy();
            const reopened = updateRequestRecord(request.id, { status: 'needs_info' })!;
            expect(reopened.shippedAt).toBe(shipped.shippedAt);
            expect(canSelectShippedStatus(reopened)).toBe(true);
        }
        finally {
            deleteRequestRecord(request.id);
        }
    });
});
