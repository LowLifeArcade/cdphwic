import { SEED_AGENCIES, SEED_INTERNAL_MEMBERS, SEED_MEMBERS, SEED_PARTICIPANTS } from '../data/seed';
import { getAllRequests } from './requestStore';
import { listProducts } from './productStore';
import type { MasterLogRow, McKessonLogRecord } from '../../shared/domain';

export const MASTER_LOG_MONTHS = [
    '12/1/2025',
    '1/1/2026',
    '2/1/2026',
    '3/1/2026',
    '4/1/2026',
    '5/1/2026',
    '6/1/2026',
    '7/1/2026',
    '8/1/2026',
    '9/1/2026',
    '10/1/2026',
    '11/1/2026',
    '12/1/2026',
    '1/1/2027',
    '2/1/2027',
    '3/1/2027',
];

function monthKey(date: string) {
    const parsed = new Date(`${date}T00:00:00Z`);
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabelToKey(label: string) {
    return monthKey(`${label.slice(-4)}-${label.split('/')[0].padStart(2, '0')}-01`);
}

function formatDate(date?: string) {
    if (!date) {
        return '';
    }
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function participantAge(dob: string | undefined, sentDate: string) {
    if (!dob || !sentDate) {
        return '';
    }
    const birth = new Date(`${dob}T00:00:00Z`);
    const sent = new Date(`${sentDate}T00:00:00Z`);
    let years = sent.getUTCFullYear() - birth.getUTCFullYear();
    let months = sent.getUTCMonth() - birth.getUTCMonth();
    if (sent.getUTCDate() < birth.getUTCDate()) {
        months -= 1;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    return `${years} yr, ${months} mo`;
}

function statusLabel(status: string) {
    return (
        {
            pending: 'PENDING',
            in_progress: 'IN REVIEW',
            approved: 'INV APP-DONE',
            denied: 'DENIED',
        }[status] ?? status.toUpperCase()
    );
}

export function getMasterLogRows(): MasterLogRow[] {
    const products = listProducts();
    return getAllRequests().map((request) => {
        const agency = SEED_AGENCIES.find((item) => item.id === request.agencyId);
        const contact = SEED_MEMBERS.find((item) => item.id === request.agencyMemberId);
        const staff = SEED_INTERNAL_MEMBERS.find((item) => item.id === request.assignedInternalMemberId);
        const participant = SEED_PARTICIPANTS.find((item) => item.familyId === request.participantFamilyId);
        const product = products.find((item) => item.id === request.productId);
        const sentDate = request.submissionDate ?? '';
        const monthlyUnits = Object.fromEntries(MASTER_LOG_MONTHS.map((label) => [monthLabelToKey(label), 0]));
        if (sentDate && monthlyUnits[monthKey(sentDate)] !== undefined) {
            monthlyUnits[monthKey(sentDate)] = request.unitsRequested ?? 0;
        }

        return {
            dateSentToState: formatDate(sentDate),
            processedBy: staff?.name ?? '',
            localAgency: agency?.name ?? '',
            contact: contact?.name ?? '',
            phoneNumber: contact?.phone ?? '',
            requestKind: request.requestKind === 'extension' ? 'Extension' : 'New',
            participant: request.participantName,
            familyId: request.participantFamilyId ? String(request.participantFamilyId) : '',
            dob: formatDate(participant?.dob),
            participantAgeOnDateSent: participantAge(participant?.dob, sentDate),
            formulaRequested: product?.name ?? request.productName,
            diagnosis: request.diagnosis ?? '',
            mediCalStatus: request.medicalStatus
                ? request.medicalStatus[0].toUpperCase() + request.medicalStatus.slice(1)
                : '',
            company: request.company ?? 'McKesson',
            dateGivenToReview: formatDate(request.dateGivenToReview ?? sentDate),
            dateOrdered: formatDate(
                request.dateOrdered ?? (request.status === 'approved' ? request.approvalDate : undefined),
            ),
            status: statusLabel(request.status),
            monthlyUnits,
        };
    });
}

export function getMasterLogExportRows() {
    return getMasterLogRows().map((row) => ({
        'Date Sent to State': row.dateSentToState,
        'Processed By': row.processedBy,
        'Local Agency': row.localAgency,
        Contact: row.contact,
        'Phone Number': row.phoneNumber,
        'New or Extension': row.requestKind,
        Participant: row.participant,
        'Family ID': row.familyId,
        DOB: row.dob,
        'Participant Age on Date Sent': row.participantAgeOnDateSent,
        'Formula Requested': row.formulaRequested,
        Diagnosis: row.diagnosis,
        'Medi-Cal Status': row.mediCalStatus,
        Company: row.company,
        'Date given to Review': row.dateGivenToReview,
        'Date Ordered': row.dateOrdered,
        STATUS: row.status,
        ...Object.fromEntries(MASTER_LOG_MONTHS.map((label) => [label, row.monthlyUnits[monthLabelToKey(label)] ?? 0])),
    }));
}

export function getMasterLogMonthlyTotals() {
    const rows = getMasterLogRows();
    return MASTER_LOG_MONTHS.map((label) => ({
        label,
        value: rows.reduce((sum, row) => sum + (row.monthlyUnits[monthLabelToKey(label)] ?? 0), 0),
    }));
}

export function getMcKessonLogRows(): McKessonLogRecord[] {
    return [
        {
            orderDate: '10/1/2026',
            line: '45',
            formula: 'Fortini Infant 4 fl oz RTF',
            poPrice: 114.25,
            cases: 11,
            amount: 1256.75,
            creditNotes: '',
            orderNumber: '86131346',
            invoiceDate: '',
            invoiceNumber: '',
            participant: 'John Doe',
            localAgency: 'Fresno EOC - West',
            address: '788 W Shaw Ave, Clovis CA 93612',
            analyst: 'Jonda',
        },
    ];
}

export function getMcKessonLogExportRows() {
    return getMcKessonLogRows().map((row) => ({
        'Order Date': row.orderDate,
        Line: row.line,
        Formula: row.formula,
        'PO Price': row.poPrice,
        Cs: row.cases,
        Amount: row.amount,
        'Credit Notes': row.creditNotes,
        'Order #': row.orderNumber,
        'Invoice Date': row.invoiceDate,
        'Invoice #': row.invoiceNumber,
        Participant: row.participant,
        'Local Agency': row.localAgency,
        Address: row.address,
        Analyst: row.analyst,
    }));
}
