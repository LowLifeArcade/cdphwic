import { SEED_AGENCIES, SEED_INTERNAL_MEMBERS, SEED_MEMBERS, SEED_USERS } from '../data/seed';
import type { DemoIdentity } from './session';

export interface AgencyProfileInput {
    name: string;
    shippingAddress: string;
    city: string;
    state: string;
    postalCode: string;
}

export interface ProfileAssignmentInput {
    user?: { name: string; email: string; phone?: string; additionalInfo?: string };
    preferredInternalMemberId?: number;
    agency?: AgencyProfileInput;
    rep?: { name: string; email: string; phone?: string };
    handledAgencyIds?: number[];
}

function userFor(identity: DemoIdentity) {
    return SEED_USERS.find((user) =>
        identity === 'admin'
            ? user.role === 'admin'
            : identity === 'agency'
              ? user.role === 'member' && user.memberType === 'agency'
              : user.role === 'member' && user.memberType === 'internal',
    );
}

export function getProfileAssignments(identity: DemoIdentity) {
    const user = userFor(identity);
    if (!user || user.role === 'admin') {
        return { identity, user, agencies: SEED_AGENCIES, handledAgencyIds: [] as number[] };
    }

    if (identity === 'agency') {
        const agency = SEED_AGENCIES.find((item) => item.id === user.agencyId);
        const rep = SEED_MEMBERS.find((item) => item.id === user.agencyMemberId);
        return { identity, user, agency, rep, analysts: SEED_INTERNAL_MEMBERS };
    }

    const staff = SEED_INTERNAL_MEMBERS.find((item) => item.id === user.internalMemberId);
    return { identity, user, agencies: SEED_AGENCIES, handledAgencyIds: staff?.handledAgencyIds ?? [] };
}

export function updateProfileAssignments(identity: DemoIdentity, input: ProfileAssignmentInput) {
    const user = userFor(identity);
    if (!user) {
        return getProfileAssignments(identity);
    }

    if (input.user) {
        Object.assign(user, input.user);
    }

    if (user.role === 'admin') {
        return getProfileAssignments(identity);
    }

    if (identity === 'agency' && user.agencyId && user.agencyMemberId) {
        const agency = SEED_AGENCIES.find((item) => item.id === user.agencyId);
        const rep = SEED_MEMBERS.find((item) => item.id === user.agencyMemberId);
        if (agency && input.agency) {
            Object.assign(agency, input.agency);
        }

        if (agency && input.preferredInternalMemberId !== undefined) {
            agency.preferredInternalMemberId = input.preferredInternalMemberId;
        }

        if (rep && input.rep) {
            Object.assign(rep, input.rep);
        }

        if (rep && input.user) {
            Object.assign(rep, { name: input.user.name, email: input.user.email, phone: input.user.phone });
        }

        user.preferredInternalMemberId = input.preferredInternalMemberId;
    }

    if (identity === 'internal' && user.internalMemberId && input.handledAgencyIds) {
        const staff = SEED_INTERNAL_MEMBERS.find((item) => item.id === user.internalMemberId);
        if (staff) {
            staff.handledAgencyIds = [...new Set(input.handledAgencyIds)];
            if (input.user) {
                Object.assign(staff, { name: input.user.name, email: input.user.email, phone: input.user.phone });
            }
        }

        user.handledAgencyIds = [...new Set(input.handledAgencyIds)];
    }

    return getProfileAssignments(identity);
}
