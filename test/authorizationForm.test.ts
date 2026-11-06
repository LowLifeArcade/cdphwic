import { describe, expect, it } from 'vitest';
import type { AgencyRecord, AgencyMemberRecord, RequestRecord } from '../shared/domain';
import { createAuthorizationFormPdf } from '../server/utils/authorizationForm';

const request: RequestRecord = {
    id: 5001,
    agencyId: 10,
    agencyMemberId: 100,
    participantName: 'Ana Garcia',
    participantFamilyId: 12345,
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
    medicalStatus: 'yes',
    mediCalStatus: 'Pending PA',
    approvedByName: 'James Kim',
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
        const {PDFPage}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
        try{await createAuthorizationFormPdf(request,agency,rep);const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('Reviewed by: James Kim');expect(text).toContain('WIC Family ID: 12345');expect(text).toContain('Medi-Cal: Pending PA');
         const participant=draw.mock.calls.find(call=>call[0]==='Ana Garcia')?.[1];const familyId=draw.mock.calls.find(call=>call[0]==='WIC Family ID: 12345')?.[1];const formula=draw.mock.calls.find(call=>call[0]==='Nutramigen Powder')?.[1];expect(familyId?.x).toBeGreaterThan(participant?.x??0);expect(familyId?.y).toBe(participant?.y);expect(formula?.x).toBe(participant?.x);
        }finally{draw.mockRestore();}
    });
});

it('includes received shipment quantities in the shipment confirmation copy',async()=>{
 const {PDFPage}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  await createAuthorizationFormPdf({...request,shipments:[{eta:'2026-11-10',casesShipped:2,unitsPerCase:6,carrier:'ups',trackingNumbers:['TRACK-1'],etaSentAt:'2026-11-02',receiptConfirmed:true,receivedAt:'2026-11-12',receivedUnits:11,damagedUnits:1}]},agency,rep,'shipment-confirmation');
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('State-Issued Formula Shipment Confirmation');expect(text).toContain('Units Received');expect(text).toContain('11 unit(s)');expect(text).toContain('Damaged Units');expect(text).toContain('1 unit(s)');expect(text).toContain('11-12-2026');
 }finally{draw.mockRestore();}
});

it('includes issuance for both formulas and paginates instead of clipping',async()=>{
 const {PDFPage,PDFDocument}=await import('pdf-lib');const {vi}=await import('vitest');
 const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const pdf=await createAuthorizationFormPdf({...request,formulaAuthorizations:[{productName:'Nutramigen',productForm:'powder',approvedCases:2,benefitIssuances:[{month:'2026-10',quantity:123}]},{productName:'Second formula',productForm:'ready-to-feed',approvedCases:3,benefitIssuances:[{month:'2026-11',quantity:234}]}]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('Second formula RTF');expect(text).toContain('234 unit(s) per month');expect(text).toContain('NOV 2026');
  expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=26)).toBe(true);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
 }finally{draw.mockRestore();}
});
it('includes Next Steps, published ETA details and three receipt signature rows with safe wrapped pagination',async()=>{
 const {PDFPage}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const pdf=await createAuthorizationFormPdf({...request,nextSteps:'Provide the approved formula to the participant. '.repeat(30),shipping:{clinicName:'Nickname omitted',addressLine1:'42 Example Road',addressLine2:'Suite 3',city:'Ukiah',state:'CA',postalCode:'95482',attention:'Nutrition Staff'},shipments:[{eta:'2026-11-10',etaSentAt:'2026-11-02',casesShipped:2,carrier:'ups',trackingNumbers:['TRACK-1','TRACK-2']} ]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('State-Issued Formula Authorization');expect(text).toContain('Next Steps');expect(text).toContain('11-10-2026');expect(text).toContain('TRACK-1, TRACK-2');expect(text).toContain('Attn: Nutrition Staff');expect(text).toContain('Monthly Receipt Confirmation');expect(text).toContain('Month / Formula / Units');expect(text).toContain('Parent/Guardian Signature');expect(text).toContain('OCT 2026');expect(text).toContain('NOV 2026');expect(text).not.toContain('CDPH/WIC');expect(text).not.toContain('Request #');expect(text).not.toContain('Health Care Provider');expect(text).not.toContain('Participant and Request');expect(text).not.toContain('Medical Formula/Nutritionals');expect(text).not.toContain('Issuance Details');
  const sectionNames=draw.mock.calls.map(call=>call[0]);expect(sectionNames.indexOf('Next Steps')).toBeLessThan(sectionNames.indexOf('Monthly Receipt Confirmation'));expect(sectionNames.indexOf('Monthly Receipt Confirmation')).toBeLessThan(sectionNames.indexOf('Inventory Handling'));expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=26)).toBe(true);
  if(process.env.AUTHORIZATION_PREVIEW){const {writeFileSync}=await import('node:fs');writeFileSync('/tmp/cdphwic-authorization-draft.pdf',pdf);}
 }finally{draw.mockRestore();}
});
