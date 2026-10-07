import type { RequestRecord, RequestScope, SessionUser } from './domain';

export function canAccessAdminFeatures(user: SessionUser): boolean {
    return user.role === 'admin';
}

export function filterRequestsByScope(
    requests: RequestRecord[],
    user: SessionUser,
    scope: RequestScope = 'all',
    filters: { agencyId?: number; repId?: number } = {},
): RequestRecord[] {
    let scoped = requests;

    if (user.role !== 'admin') {
        if (user.memberType === 'agency' && user.agencyId) {
            scoped = scoped.filter((request) => request.agencyId === user.agencyId);
        }
        if (user.memberType === 'internal' && user.handledAgencyIds) {
            scoped = scoped.filter((request) => user.handledAgencyIds?.includes(request.agencyId));
        }
        if (scope === 'mine' && user.memberType === 'agency' && user.agencyMemberId) {
            scoped = scoped.filter((request) => request.agencyMemberId === user.agencyMemberId);
        }
        if (scope === 'mine' && user.memberType === 'internal') {
            scoped = scoped.filter((request) => user.handledRepIds?.includes(request.agencyMemberId));
        }
    } else if (scope === 'mine' && user.internalMemberId) {
        scoped = scoped.filter((request) => request.assignedInternalMemberId === user.internalMemberId);
    }

    if (filters.agencyId) {
        scoped = scoped.filter((request) => request.agencyId === filters.agencyId);
    }
    if (filters.repId) {
        scoped = scoped.filter((request) => request.agencyMemberId === filters.repId);
    }

    return scoped;
}
