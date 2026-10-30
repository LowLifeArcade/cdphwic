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

it('includes issuance for both formulas and paginates instead of clipping',async()=>{
 const {PDFPage,PDFDocument}=await import('pdf-lib');const {vi}=await import('vitest');
 const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const pdf=await createAuthorizationFormPdf({...request,formulaAuthorizations:[{productName:'Nutramigen',productForm:'powder',approvedCases:2,benefitIssuances:[{month:'2026-10',quantity:123}]},{productName:'Second formula',productForm:'ready-to-feed',approvedCases:3,benefitIssuances:[{month:'2026-11',quantity:234}]}]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('Second formula');expect(text).toContain('234 units');expect(text).toContain('NOV 2026');
  expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=40)).toBe(true);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
 }finally{draw.mockRestore();}
});
