export type UserRole = 'admin' | 'member';
export type MemberType = 'internal' | 'agency';
export type RequestStatus = 'pending' | 'in_progress' | 'approved' | 'denied';
export type RequestScope = 'all' | 'mine';

export interface SessionUser {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    additionalInfo?: string;
    role: UserRole;
    memberType: MemberType;
    agencyId?: number;
    agencyMemberId?: number;
    internalMemberId?: number;
    handledAgencyIds?: number[];
    handledRepIds?: number[];
    preferredInternalMemberId?: number;
}

export interface RequestRecord {
    id: number;
    agencyId: number;
    agencyMemberId: number;
    assignedInternalMemberId?: number;
    participantFamilyId?: number;
    participantName: string;
    productId?: number;
    productName: string;
    category?: 'standard' | 'exempt' | 'nutritional';
    status: RequestStatus;
    submissionDate?: string;
    approvalDate?: string;
    denialDate?: string;
    eta?: string;
    unitsRequested?: number;
    medicalStatus?: 'yes' | 'no' | 'pending';
    diagnosis?: string;
    comments?: string;
    internalComments?: string;
    trackingNumber?: string;
    deliveryStatus?: string;
    replacementRequested?: boolean;
    genericFields?: Record<string, string>;
}

export interface AgencyRecord {
    id: number;
    name: string;
    shippingAddress: string;
    city: string;
    state: string;
    postalCode: string;
    preferredInternalMemberId?: number;
}

export interface AgencyMemberRecord {
    id: number;
    agencyId: number;
    name: string;
    email: string;
    preferredInternalMemberId?: number;
}

export interface InternalMemberRecord {
    id: number;
    name: string;
    email: string;
    handledAgencyIds: number[];
    handledRepIds: number[];
}

export interface ProductRecord {
    id: number;
    name: string;
    form: string;
    category: 'standard' | 'exempt' | 'nutritional';
    unitsPerCase: number;
    bottlesPerCase: number;
    unitPrice?: number;
    supplierReference?: string;
    genericFields?: Record<string, string>;
}

export interface ParticipantRecord {
    familyId: number;
    name: string;
    dob: string;
    benefitsCycleDate: string;
    medicalStatus: 'yes' | 'no' | 'pending';
}

export interface SummaryRecord {
    unitsByProduct: Array<{ label: string; value: number }>;
    topFormulas: Array<{ label: string; value: number }>;
    requestsByAgency: Array<{ label: string; value: number }>;
    monthlyCases: number;
    monthlyCapacity: number;
    averageUnitsPerMonth: number;
}
