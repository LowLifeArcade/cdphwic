import { describe, expect, it } from 'vitest';
import type { RequestRecord, SessionUser } from '../shared/domain';
import { canAccessAdminFeatures, filterRequestsByScope } from '../shared/requestScope';

const requests: RequestRecord[] = [
    {
        id: 1,
        agencyId: 10,
        agencyMemberId: 100,
        assignedInternalMemberId: 200,
        participantName: 'Ana',
        productName: 'Nutramigen',
        status: 'pending',
    },
    {
        id: 2,
        agencyId: 10,
        agencyMemberId: 101,
        assignedInternalMemberId: 200,
        participantName: 'Ben',
        productName: 'EleCare',
        status: 'approved',
    },
    {
        id: 3,
        agencyId: 11,
        agencyMemberId: 102,
        assignedInternalMemberId: 201,
        participantName: 'Cara',
        productName: 'Neocate',
        status: 'in_progress',
    },
];

const agencyMember: SessionUser = {
    id: 100,
    name: 'Agency Rep',
    role: 'member',
    memberType: 'agency',
    agencyId: 10,
    agencyMemberId: 100,
};
const internalMember: SessionUser = {
    id: 200,
    name: 'FPU Analyst',
    role: 'member',
    memberType: 'internal',
    handledAgencyIds: [10],
    handledRepIds: [101],
};
const admin: SessionUser = { id: 1, name: 'Admin', role: 'admin', memberType: 'internal' };

describe('request scope rules', () => {
    it('shows all agency requests and limits My Requests to the logged-in rep', () => {
        expect(filterRequestsByScope(requests, agencyMember, 'all').map((item) => item.id)).toEqual([1, 2]);
        expect(filterRequestsByScope(requests, agencyMember, 'mine').map((item) => item.id)).toEqual([1]);
    });

    it('shows handled agencies and explicitly handled reps for internal staff', () => {
        expect(filterRequestsByScope(requests, internalMember, 'all').map((item) => item.id)).toEqual([1, 2]);
        expect(filterRequestsByScope(requests, internalMember, 'mine').map((item) => item.id)).toEqual([2]);
    });

    it('allows admins to access admin features', () => {
        expect(canAccessAdminFeatures(admin)).toBe(true);
        expect(canAccessAdminFeatures(agencyMember)).toBe(false);
    });
});
