import { describe, expect, it } from 'vitest';
import type { AgencyRecord, AgencyMemberRecord, RequestRecord } from '../shared/domain';
import { createAuthorizationFormPdf } from '../server/utils/authorizationForm';

const request: RequestRecord = {
    id: 5001,
    agencyId: 10,
    agencyMemberId: 100,
    participantName: 'Ana Garcia',
    participantDob: '2024-02-14',
    productName: 'Nutramigen',
    productForm: 'powder',
    status: 'approved',
    submissionDate: '2026-10-03',
    approvalDate: '2026-10-06',
    dateOrdered: '2026-10-07',
    ouncesPrescribed: 12,
    durationMonths: 2,
    benefitsStartDate: '2026-10-01',
    benefitIssuances: [
        { month: '2026-10', quantity: 12 },
        { month: '2026-11', quantity: 6 },
    ],
};

const agency: AgencyRecord = {
    id: 10,
    name: 'Mendocino County',
    shippingAddress: '123 Main Street',
    city: 'Ukiah',
    state: 'CA',
    postalCode: '95482',
};

const rep: AgencyMemberRecord = {
    id: 100,
    agencyId: 10,
    name: 'Maria Lopez',
    email: 'maria@mendocino.example',
    phone: '(707) 555-0100',
};

describe('authorization form PDF', () => {
    it('creates a PDF containing the request context', async () => {
        const pdf = await createAuthorizationFormPdf(request, agency, rep);
        expect(pdf.slice(0, 5)).toEqual(new TextEncoder().encode('%PDF-'));
        expect(pdf.byteLength).toBeGreaterThan(1000);
    });
});
