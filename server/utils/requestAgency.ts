import type { SessionUser } from '../../shared/domain';
import { SEED_AGENCIES, SEED_MEMBERS } from '../data/seed';
export function requestAgency(
    user: SessionUser,
    agencyId: number,
    agencyMemberId: number | undefined,
    allowUnassigned = false,
) {
    const fail = (statusCode: number, statusMessage: string) => {
        throw Object.assign(new Error(statusMessage), { statusCode, statusMessage });
    };
    if (!SEED_AGENCIES.some((a) => a.id === agencyId)) fail(400, 'Select a valid Local Agency.');
    if (
        user.role !== 'admin' &&
        (user.memberType === 'agency' ? user.agencyId !== agencyId : !user.handledAgencyIds?.includes(agencyId))
    )
        fail(403, 'You cannot create requests for this local agency.');
    const memberId = user.memberType === 'agency' ? user.agencyMemberId : agencyMemberId;
    if (!SEED_MEMBERS.some((m) => m.id === memberId && m.agencyId === agencyId)) {
        if (allowUnassigned && !memberId) return { agencyId, agencyMemberId: 0 };
        fail(400, 'Select a local agency representative belonging to this agency.');
    }
    return { agencyId, agencyMemberId: memberId! };
}
