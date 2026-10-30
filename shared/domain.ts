import type {DistributorSnapshot} from './distributors';
import type {DamageImage} from './shipmentEvidence';
import type {BreastfeedingStatus} from './breastfeeding';
import type {RequestShipping} from './shipping';
export type UserRole = 'admin' | 'member';
export type MemberType = 'internal' | 'agency';
export type RequestStatus =
    | 'incomplete'
    | 'unopened'
    | 'opened'
    | 'pending'
    | 'in_progress'
    | 'needs_info'
    | 'approved'
    | 'shipped'
    | 'complete'
    | 'damaged'
    | 'missing'
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

export interface RequestedFormula {
    productName: string;
    productForm: ProductForm;
    ouncesPrescribed: number;
    readyToFeedJustification?: string;
    flavor?: string;
    otherFormulaName?: string;
}

export interface RequestRecord {
    shipping?: RequestShipping;
    openedAt?: string;
    revision?: number;
    submissionId?: string;
    requestedFormulas?: RequestedFormula[];
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
    shippedAt?: string;
    unitsRequested?: number;
    ouncesPrescribed?: number;
    durationMonths?: number;
    wicIndividualId?: string;
    benefitsStartDate?: string;
    doctorPrintedName?: string;
    doctorHasSignedOff?: boolean;
    doctorSignature?: string;
    doctorOfficeName?: string;
    doctorOfficeAddress?: string;
    doctorOfficePhone?: string;
    prescriptionAttachment?: {
        storageKey: string;
        fileName: string;
        contentType: string;
        size: number;
    };
    prescriptionSignedDate?: string;
    medicalStatus?: 'yes' | 'no' | 'pending';
    mediCalStatus?: 'Denied' | 'Pending PA' | 'Product Not Covered';
    diagnosis?: string;
    wicFoodRestrictions?: 'under-6-months' | 'none' | 'restricted' | 'not-indicated';
    wicFoodRestrictionDetails?: string;
    wicStaffFoodRestrictions?: 'none' | 'restricted';
    wicNutritionStaffNotes?: string;
    wicNutritionStaffName?: string;
    formulaFlavor?: string;
    comments?: string;
    internalComments?: string;
    trackingNumber?: string;
    shipmentDrafts?: RequestRecord['shipments'];
    deletedShipments?: Array<{shipment:NonNullable<RequestRecord['shipments']>[number];draft?:NonNullable<RequestRecord['shipments']>[number];deletedAt:string;deletedBy:number}>;
    shipments?: Array<{
        shipmentSource?:'distributor'|'agency';
        sourceAgencyId?:number;
        sourceAgencyName?:string;
        sourceLotId?:string;
        transferId?:string;
        transferStatus?:'reserved'|'shipped'|'received';
        transferQuantity?:number;
        transferFormulaName?:string;
        transferForm?:string;
        transferFlavor?:string;
        transferExpiration?:string;
        eta: string;
        casesShipped: number;
        supplier?: string;
        distributorId?:string;
        distributorPolicy?:DistributorSnapshot;
        policyHistory?:Array<{policy?:DistributorSnapshot;changedAt:string;changedBy:number;reason:string}>;
        looseUnitsShipped?:number;
        replacementBasis?:'units'|'cases';
        replacementIssueId?:string;
        unitsPerCase?: number;
        receivedUnits?: number;
        damagedUnits?: number;
        etaSentAt?: string;
        dispatched?: boolean;
        receivedAt?: string;
        receiptConfirmed?: boolean;
        receiptMode?: 'simple'|'quantity';
        receivedBy?: number;
        replacementFor?: number;
        replacedAt?: string;
        replacedBy?: number;
        replacementClosureNote?: string;
        receivedCases?: number;
        dispositions?: Array<{kind:'returned'|'destroyed';cases:number;looseUnits?:number;units?:number;damagedUnits?:number;notes:string;recordedAt:string;recordedBy:number}>;
        receiptCountHistory?: Array<{cases:number;looseUnits?:number;units?:number;damagedUnits?:number;unitsPerCase?:number;notes:string;recordedAt:string;recordedBy:number}>;
        deletedIssues?: Array<{issue:NonNullable<NonNullable<RequestRecord['shipments']>[number]['issue']>;deletedAt:string;deletedBy:number}>;
        issue?: {id?:string;labelsSent?:{date:string;reference:string;recordedAt:string;recordedBy:number};images?:DamageImage[];source?:'receipt-quantity'|'receipt-confirmation';type:'damaged'|'missing'|'incomplete';notes:string;reportedAt:string;reportedBy:number;resolvedAt?:string;resolvedBy?:number;updatedAt?:string;updatedBy?:number;reopenedAt?:string;reopenedBy?:number;responses?:Array<{notes:string;createdAt:string;createdBy:number}>};
        carrier: 'fedex' | 'dhl' | 'ups' | 'agency';
        trackingNumbers: string[];
    }>;
    trackingNumbers?: Array<{ number: string; carrier: 'fedex' | 'dhl' | 'ups' | 'agency' }>;
    deliveryStatus?: string;
    specialOrder?: boolean;
    approved?: boolean;
    unitsIssued?: number;
    benefitIssuanceStartMonth?: string;
    benefitIssuanceEndMonth?: string;
    benefitIssuances?: Array<{ month: string; quantity: number }>;
    benefitMonthsRequested?: string[];
    approvedCases?: number;
    originalApprovedCases?: number;
    approvedMonths?: number;
    casesOrdered?: number;
    expectedSurplus?: number;
    expectedSurplusUnit?: 'units' | 'cases';
    agencyUnitsOnHand?: number;
    agencyUnitsOnHandUnit?: 'units' | 'cases';
    surplusItems?: Array<{ productName: string; productForm?: ProductForm; flavor?: string; units: number; expirationDate: string }>;
    staffNotes?: string;
    nextSteps?: string;
    repNotes?: string;
    agencyConfirmationAlertedAt?: string;
    receivedStatus?: 'shipped' | 'received' | 'damaged' | 'missing' | 'incomplete';
    receivedPhotos?: string[];
    replacementRequested?: boolean;
    requestKind?: 'new' | 'extension';
    breastfeedingStatus?: BreastfeedingStatus | '';
    breastfeedingDiscontinuedDate?: string;
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
    yield?: number;
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
