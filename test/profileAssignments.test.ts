import { describe, expect, it } from 'vitest';
import { getProfileAssignments, updateProfileAssignments } from '../server/utils/profileStore';

describe('profile assignment updates', () => {
    it('updates common account fields for an admin', () => {
        updateProfileAssignments('admin', {
            user: {
                name: 'Admin Updated',
                email: 'admin-updated@example.com',
                phone: '555-0199',
                additionalInfo: 'Billing contact',
            },
        });
        expect(getProfileAssignments('admin').user).toMatchObject({
            name: 'Admin Updated',
            email: 'admin-updated@example.com',
            phone: '555-0199',
            additionalInfo: 'Billing contact',
        });
    });

    it('updates an agency representative and their agency preferred analyst', () => {
        updateProfileAssignments('agency', {
            preferredInternalMemberId: 200,
            agency: {
                name: 'Mendocino County',
                shippingAddress: '9 New Road',
                city: 'Ukiah',
                state: 'CA',
                postalCode: '95482',
            },
            rep: { name: 'Maria Lopez', email: 'maria@mendocino.example', phone: '555-0100' },
        });
        const profile = getProfileAssignments('agency');
        expect(profile.agency?.shippingAddress).toBe('9 New Road');
        expect(profile.agency?.preferredInternalMemberId).toBe(200);
        expect(profile.rep?.phone).toBe('555-0100');
    });

    it('updates the handled agency IDs for internal staff', () => {
        updateProfileAssignments('internal', { handledAgencyIds: [10, 12] });
        expect(getProfileAssignments('internal').handledAgencyIds).toEqual([10, 12]);
    });
});
