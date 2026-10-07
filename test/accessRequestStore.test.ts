import { describe, expect, it } from 'vitest';
import { approveAccessRequest, createAccessRequest, denyAccessRequest } from '../server/utils/accessStore';

describe('access request processing', () => {
    it('approves a request into an email-specific invitation', () => {
        const request = createAccessRequest({
            name: 'New Rep',
            email: 'rep@example.com',
            localAgencyName: 'Lake County',
            note: 'Need portal access.',
            requestedMemberType: 'agency',
        });
        const invitation = approveAccessRequest(request.id, 'agency_rep', 11);
        expect(invitation.url).toMatch(/^\/signup\/invite_/);
    });

    it('records denial reasons', () => {
        const request = createAccessRequest({
            name: 'No Access',
            email: 'no@example.com',
            note: 'Request.',
            requestedMemberType: 'internal',
        });
        expect(denyAccessRequest(request.id, 'Please contact your supervisor.').denialReason).toBe(
            'Please contact your supervisor.',
        );
    });
});
