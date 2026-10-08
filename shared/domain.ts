export type UserRole = 'admin' | 'member';
export type MemberType = 'internal' | 'agency';
export type RequestStatus =
    | 'unopened'
    | 'opened'
    | 'pending'
    | 'in_progress'
    | 'needs_info'
    | 'approved'
    | 'shipped'
    | 'complete'
    | 'denied';
export type RequestScope = 'all' | 'mine';
export type ProductCoverage = 'wic' | 'medical';
export type ProductForm = 'powder' | 'concentrate' | 'ready-to-feed';

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
    participantFirstName?: string;
    participantLastName?: string;
    participantDob?: string;
    productId?: number;
    productName: string;
    productForm?: ProductForm;
    category?: 'standard' | 'exempt' | 'nutritional';
    status: RequestStatus;
    submissionDate?: string;
    approvalDate?: string;
    denialDate?: string;
    eta?: string;
    unitsRequested?: number;
    ouncesPrescribed?: number;
    durationMonths?: number;
    wicIndividualId?: string;
    benefitsStartDate?: string;
    doctorPrintedName?: string;
    doctorSignature?: string;
    doctorOfficeName?: string;
    doctorOfficeAddress?: string;
    doctorOfficePhone?: string;
    prescriptionSignedDate?: string;
    medicalStatus?: 'yes' | 'no' | 'pending';
    diagnosis?: string;
    comments?: string;
    internalComments?: string;
    trackingNumber?: string;
    trackingNumbers?: Array<{ number: string; carrier: 'fedex' | 'dhl' | 'ups' }>;
    deliveryStatus?: string;
    specialOrder?: boolean;
    unitsIssued?: number;
    benefitIssuanceStartMonth?: string;
    benefitIssuanceEndMonth?: string;
    staffNotes?: string;
    repNotes?: string;
    receivedStatus?: 'shipped' | 'received' | 'damaged' | 'missing';
    receivedPhotos?: string[];
    replacementRequested?: boolean;
    requestKind?: 'new' | 'extension';
    dateGivenToReview?: string;
    dateOrdered?: string;
    company?: string;
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
    phone?: string;
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
    productId: string;
    productCode: string;
    name: string;
    form: ProductForm;
    category: 'standard' | 'exempt' | 'nutritional';
    unitsPerCase: number;
    coverage: ProductCoverage[];
    poPrice?: number;
    casesApproved?: number;
    casesUsed?: number;
    casesRemaining?: number;
    dollarsApproved?: number;
    dollarsUsed?: number;
    dollarsRemaining?: number;
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
    masterLogByMonth?: Array<{ label: string; value: number }>;
}

export interface MasterLogRow {
    dateSentToState: string;
    processedBy: string;
    localAgency: string;
    contact: string;
    phoneNumber: string;
    requestKind: string;
    participant: string;
    familyId: string;
    dob: string;
    participantAgeOnDateSent: string;
    formulaRequested: string;
    diagnosis: string;
    mediCalStatus: string;
    company: string;
    dateGivenToReview: string;
    dateOrdered: string;
    status: string;
    monthlyUnits: Record<string, number>;
}

export interface McKessonLogRecord {
    orderDate: string;
    line: string;
    formula: string;
    poPrice: number;
    cases: number;
    amount: number;
    creditNotes: string;
    orderNumber: string;
    invoiceDate: string;
    invoiceNumber: string;
    participant: string;
    localAgency: string;
    address: string;
    analyst: string;
}
