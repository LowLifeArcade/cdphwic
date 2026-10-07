export type InvitationType = 'agency_rep' | 'staff';
export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export interface AccessRequest {
    id: number;
    name: string;
    email?: string;
    localAgencyName?: string;
    staffId?: string;
    note: string;
    requestedMemberType: 'agency' | 'internal';
    status: AccessRequestStatus;
    reviewedAt?: string;
    denialReason?: string;
    createdAt: string;
}

export interface SignupTokenPreview {
    token: string;
    email: string;
    maskedEmail: string;
    invitationType: InvitationType;
    agency?: { id: number; name: string; county: string; shippingAddress: string };
    expiresAt: string;
    verified: boolean;
    used: boolean;
}

export interface SignupCompletionInput {
    signupSessionToken: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    agency?: { name: string; county: string; shippingAddress: string };
    agencyId?: number;
    handledAgencyIds?: number[];
}

export function maskEmail(email: string): string {
    const [local, domain] = email.trim().toLowerCase().split('@');
    if (!local || !domain) return 'hidden email';
    return `${local.slice(0, 1)}***@${domain}`;
}

export function validateAccessRequest(input: { name?: string; email?: string; note?: string }) {
    const errors: Record<string, string> = {};
    if (!input.name?.trim()) errors.name = 'Name is required.';
    if (!input.email?.trim() || !/^\S+@\S+\.\S+$/.test(input.email.trim())) errors.email = 'Enter a valid email.';
    if (!input.note?.trim()) errors.note = 'A reason for access is required.';
    return errors;
}

export function isInvitationType(value: string): value is InvitationType {
    return value === 'agency_rep' || value === 'staff';
}
