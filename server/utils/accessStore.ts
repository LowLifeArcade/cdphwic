import { SEED_AGENCIES, SEED_USERS } from '../data/seed';
import type { AgencyRecord, SessionUser } from '../../shared/domain';
import type { AccessRequest, InvitationType, SignupCompletionInput, SignupTokenPreview } from '../../shared/accessFlow';
import { maskEmail } from '../../shared/accessFlow';

interface StoredToken {
    id: number;
    token: string;
    email: string;
    invitationType: InvitationType;
    agencyId?: number;
    accessRequestId?: number;
    expiresAt: string;
    usedAt?: string;
    code?: string;
    codeExpiresAt?: string;
    attempts: number;
    verifiedAt?: string;
}

const accessRequests: AccessRequest[] = [];
const tokens = new Map<string, StoredToken>();
const signupSessions = new Map<string, { token: string; expiresAt: string }>();
let nextId = 1;
let nextAgencyId = Math.max(...SEED_AGENCIES.map((agency) => agency.id)) + 1;

function randomToken(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function agencyPreview(agencyId?: number) {
    const agency = SEED_AGENCIES.find((item) => item.id === agencyId);
    return agency
        ? {
              id: agency.id,
              name: agency.name,
              county: agency.name.replace(/\s+County$/i, ''),
              shippingAddress: agency.shippingAddress,
          }
        : undefined;
}

export function listAccessRequests() {
    return structuredClone(accessRequests);
}

export function createAccessRequest(input: Omit<AccessRequest, 'id' | 'status' | 'createdAt'>) {
    const request: AccessRequest = { ...input, id: nextId++, status: 'pending', createdAt: new Date().toISOString() };
    accessRequests.unshift(request);
    return structuredClone(request);
}

export function createInvitation(input: {
    email: string;
    invitationType: InvitationType;
    agencyId?: number;
    accessRequestId?: number;
}) {
    const token = randomToken('invite');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    tokens.set(token, {
        id: nextId++,
        token,
        email: input.email.toLowerCase(),
        invitationType: input.invitationType,
        agencyId: input.agencyId,
        accessRequestId: input.accessRequestId,
        expiresAt,
        attempts: 0,
    });
    return { token, url: `/signup/${token}`, expiresAt };
}

export function getTokenPreview(token: string): SignupTokenPreview | null {
    const item = tokens.get(token);
    if (!item) return null;
    return {
        token: item.token,
        email: item.email,
        maskedEmail: maskEmail(item.email),
        invitationType: item.invitationType,
        agency: agencyPreview(item.agencyId),
        expiresAt: item.expiresAt,
        verified: Boolean(item.verifiedAt),
        used: Boolean(item.usedAt),
    };
}

export function startVerification(token: string) {
    const item = tokens.get(token);
    if (!item || item.usedAt || Date.parse(item.expiresAt) <= Date.now())
        throw new Error('Invitation is invalid or expired.');
    item.code = String(Math.floor(100000 + Math.random() * 900000));
    item.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    item.attempts = 0;
    return { maskedEmail: maskEmail(item.email), developmentCode: item.code, expiresAt: item.codeExpiresAt };
}

export function completeVerification(token: string, code: string) {
    const item = tokens.get(token);
    if (!item || item.usedAt || !item.code || !item.codeExpiresAt || Date.parse(item.codeExpiresAt) <= Date.now())
        throw new Error('Verification code is invalid or expired.');
    if (item.attempts >= 5) throw new Error('Too many verification attempts.');
    item.attempts += 1;
    if (item.code !== code) throw new Error('Verification code is invalid or expired.');
    item.verifiedAt = new Date().toISOString();
    item.code = undefined;
    const signupSessionToken = randomToken('signup');
    signupSessions.set(signupSessionToken, { token, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    return { signupSessionToken, invitationType: item.invitationType, agency: agencyPreview(item.agencyId) };
}

export function completeSignup(input: SignupCompletionInput) {
    const session = signupSessions.get(input.signupSessionToken);
    if (!session || Date.parse(session.expiresAt) <= Date.now())
        throw new Error('Signup session is invalid or expired.');
    const item = tokens.get(session.token);
    if (!item || !item.verifiedAt || item.usedAt) throw new Error('Signup session is invalid.');
    if (item.invitationType === 'agency_rep' && input.agencyId && input.agencyId !== item.agencyId)
        throw new Error('Agency cannot be changed for this invitation.');
    if (item.invitationType === 'agency_rep' && item.agencyId && input.agency) {
        const agency = SEED_AGENCIES.find((record) => record.id === item.agencyId);
        if (agency) {
            agency.name = input.agency.name;
            agency.shippingAddress = input.agency.shippingAddress;
            agency.city = input.agency.county;
        }
    }
    item.usedAt = new Date().toISOString();
    signupSessions.delete(input.signupSessionToken);
    return {
        message: 'Signup completed.',
        user: {
            name: `${input.firstName} ${input.lastName}`,
            email: item.email,
            role: 'member',
            memberType: item.invitationType === 'staff' ? 'internal' : 'agency',
        },
        agencyId: item.agencyId,
        handledAgencyIds: input.handledAgencyIds ?? [],
    };
}

export function createAgency(input: Pick<AgencyRecord, 'name' | 'shippingAddress' | 'city' | 'state' | 'postalCode'>) {
    const agency: AgencyRecord = { ...input, id: nextAgencyId++, active: true } as AgencyRecord;
    SEED_AGENCIES.push(agency);
    return structuredClone(agency);
}

export function approveAccessRequest(id: number, invitationType: InvitationType, agencyId?: number) {
    const request = accessRequests.find((item) => item.id === id);
    if (!request || request.status !== 'pending') throw new Error('Access request is not pending.');
    request.status = 'approved';
    request.reviewedAt = new Date().toISOString();
    return createInvitation({ email: request.email, invitationType, agencyId, accessRequestId: id });
}

export function denyAccessRequest(id: number, denialReason: string) {
    const request = accessRequests.find((item) => item.id === id);
    if (!request || request.status !== 'pending') throw new Error('Access request is not pending.');
    request.status = 'denied';
    request.denialReason = denialReason;
    request.reviewedAt = new Date().toISOString();
    return structuredClone(request);
}

export function findUserByEmail(email: string): SessionUser | undefined {
    return SEED_USERS.find((user) => user.email?.toLowerCase() === email.toLowerCase());
}
