import { describe, expect, it } from 'vitest';
import {
    completeSignup,
    completeVerification,
    createInvitation,
    getTokenPreview,
    startVerification,
} from '../server/utils/accessStore';

describe('invitation verification', () => {
    it('requires email verification before signup completion and consumes the invite once', () => {
        const invitation = createInvitation({ email: 'new@example.com', invitationType: 'staff' });
        expect(getTokenPreview(invitation.token)?.maskedEmail).toBe('n***@example.com');
        expect(() =>
            completeSignup({
                signupSessionToken: 'missing',
                firstName: 'New',
                lastName: 'User',
                email: 'new@example.com',
            }),
        ).toThrow();
        const delivery = startVerification(invitation.token);
        const verified = completeVerification(invitation.token, delivery.developmentCode);
        expect(
            completeSignup({
                signupSessionToken: verified.signupSessionToken,
                firstName: 'New',
                lastName: 'User',
                email: 'new@example.com',
            }).message,
        ).toBe('Signup completed.');
        expect(() => completeVerification(invitation.token, delivery.developmentCode)).toThrow();
    });
});
