import { describe, expect, it } from 'vitest';
import { getDemoUser } from '../server/utils/session';
import { createRequestRecord, getRequestsForUser } from '../server/utils/requestStore';

describe('development API contracts', () => {
    it('resolves demo identities for admin and member flows', () => {
        expect(getDemoUser('admin').role).toBe('admin');
        expect(getDemoUser('agency').memberType).toBe('agency');
        expect(getDemoUser('internal').memberType).toBe('internal');
    });

    it('filters request lists and accepts optional generic fields', () => {
        const agencyUser = getDemoUser('agency');
        expect(getRequestsForUser(agencyUser, 'all')).toHaveLength(2);
        expect(getRequestsForUser(agencyUser, 'mine')).toHaveLength(1);

        const created = createRequestRecord({
            agencyId: 10,
            agencyMemberId: 100,
            participantName: 'New Participant',
            productName: 'Nutramigen',
            status: 'pending',
            genericFields: { externalReference: 'demo-123' },
        });
        expect(created.genericFields?.externalReference).toBe('demo-123');
    });
});
