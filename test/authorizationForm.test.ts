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
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('State-Issued Formula Shipment Confirmation');expect(text).toContain('Units Received');expect(text).toContain('11 Units');expect(text).toContain('Damaged Units');expect(text).toContain('1 Unit');expect(text).toContain('11-12-2026');
 }finally{draw.mockRestore();}
});

it('includes issuance for both formulas and paginates instead of clipping',async()=>{
 const {PDFPage,PDFDocument}=await import('pdf-lib');const {vi}=await import('vitest');
 const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const pdf=await createAuthorizationFormPdf({...request,nextSteps:'Follow the approved issuance schedule. '.repeat(25),formulaAuthorizations:[{productName:'Nutramigen',productForm:'powder',approvedCases:2,benefitIssuances:[{month:'2026-10',quantity:123}]},{productName:'Second formula',productForm:'ready-to-feed',approvedCases:3,benefitIssuances:[{month:'2026-11',quantity:234}]}]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('Second formula RTF');expect(text).toContain('234');expect(text).toContain('Units');expect(text).toContain('NOV 2026');
  expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=26)).toBe(true);expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
 }finally{draw.mockRestore();}
});

it('includes Next Steps, published ETA details and three receipt signature rows with safe wrapped pagination',async()=>{
 const {PDFPage}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const pdf=await createAuthorizationFormPdf({...request,nextSteps:'Provide the approved formula to the participant. '.repeat(30),shipping:{clinicName:'Nickname omitted',addressLine1:'42 Example Road',addressLine2:'Suite 3',city:'Ukiah',state:'CA',postalCode:'95482',attention:'Nutrition Staff'},shipments:[{eta:'2026-11-10',etaSentAt:'2026-11-02',casesShipped:2,carrier:'ups',trackingNumbers:['TRACK-1','TRACK-2']} ]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('State-Issued Formula Authorization');expect(text).toContain('Next Steps');expect(text).toContain('11-10-2026');expect(text).toContain('TRACK-1, TRACK-2');expect(text).toContain('Attn: Nutrition Staff');expect(text).toContain('Monthly Receipt Confirmation');expect(text).not.toContain('Month / Formula / Units');expect(text).toContain('12 Units');expect(text).toContain('Parent/Guardian Signature');expect(text).toContain('OCT 2026');expect(text).toContain('NOV 2026');expect(text).not.toContain('CDPH/WIC');expect(text).not.toContain('Request #');expect(text).not.toContain('Health Care Provider');expect(text).not.toContain('Participant and Request');expect(text).not.toContain('Medical Formula/Nutritionals');expect(text).not.toContain('Issuance Details');
  const sectionNames=draw.mock.calls.map(call=>call[0]);expect(sectionNames.indexOf('Next Steps')).toBeLessThan(sectionNames.indexOf('Monthly Receipt Confirmation'));expect(sectionNames.indexOf('Monthly Receipt Confirmation')).toBeLessThan(sectionNames.indexOf('Inventory Handling'));expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=26)).toBe(true);
  if(process.env.AUTHORIZATION_PREVIEW){const {writeFileSync}=await import('node:fs');writeFileSync('/tmp/cdphwic-authorization-draft.pdf',pdf);}
 }finally{draw.mockRestore();}
});

it('aligns approved monthly and supply quantities and shows case conversion and transfer agency',async()=>{
 const {PDFPage,StandardFonts,PDFDocument}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const formula={productName:'Nutramigen',productForm:'powder' as const};
  const sample={...request,participantName:'Sample Participant',formulaAuthorizations:[{...formula,formulaName:'Nutramigen',productCode:'123456',unitsPerCase:6,yield:32,totalUnitsIssued:18,localSurplusAllocations:[{lotId:'local',units:10}],benefitIssuances:[{month:'2026-11',quantity:6},{month:'2026-12',quantity:6},{month:'2027-01',quantity:6}]}],shipments:[{eta:'2026-11-20',casesShipped:0,looseUnitsShipped:4,unitsPerCase:6,unitsToTransfer:4,shipmentSource:'agency' as const,transferId:'sample-transfer',sourceAgencyName:'Sample Sending Agency',carrier:'gso' as const,trackingNumbers:[],shipmentFormula:formula},{eta:'2026-11-20',casesShipped:1,unitsPerCase:6,shipmentSource:'distributor' as const,supplier:'McKesson',dispatched:true,carrier:'ups' as const,trackingNumbers:['SAMPLE-TRACKING'],etaSentAt:'2026-11-17',shipmentFormula:formula}]};
  const pdf=await createAuthorizationFormPdf(sample,agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');
  expect(text).toContain('Supply Plan');expect(text).toContain('On Hand');expect(text).toContain('18 Units Approved');expect(text).not.toContain('Units Needed from Orders');expect(text).not.toContain('Allocated Transfers');expect(text).toContain('Transfer from Sample Sending');expect(text).toContain('Shipped from McKesson');const monthPosition=draw.mock.calls.find(call=>call[0]==='NOV 2026')?.[1];const planPosition=draw.mock.calls.find(call=>call[0]==='Supply Plan')?.[1];expect(planPosition?.x).toBeGreaterThan(330);expect(monthPosition?.x).toBeLessThan(100);expect(Math.abs((monthPosition?.y??0)-(planPosition?.y??0))).toBeLessThan(50);expect(text).toContain('1 Case x 6 Units');expect(text).toContain('Expected Surplus');expect(text).toContain('Product Number: 123456');expect(text).not.toContain('Form\n');const monthly=draw.mock.calls.find(call=>call[0]==='6 Units per month');expect(monthly?.[1]?.size).toBe(14);
  const quantities=draw.mock.calls.filter(call=>['18','10','4','6','2'].includes(call[0])&&(call[1]?.x??0)>450);
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.HelveticaBold);
  expect(quantities.length).toBeGreaterThanOrEqual(4);
  for(const [text,options] of quantities){expect((options!.x??0)+font.widthOfTextAtSize(text,options!.size??10)).toBeCloseTo(510,4);}
  const units=draw.mock.calls.filter(call=>call[0]==='Units');expect(units.length).toBeGreaterThanOrEqual(4);expect(units.every(call=>call[1]?.x===522)).toBe(true);
  if(process.env.AUTHORIZATION_PREVIEW){const {mkdirSync,writeFileSync}=await import('node:fs');mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/authorization-supply-sample.pdf',pdf);}
 }finally{draw.mockRestore();}
});

it('continues a long monthly schedule without clipping either column',async()=>{
 const {PDFPage,PDFDocument}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  const months=Array.from({length:18},(_,index)=>({month:`${2026+Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`,quantity:6}));
  const pdf=await createAuthorizationFormPdf({...request,formulaAuthorizations:[{productName:'Nutramigen',productForm:'powder',unitsPerCase:6,totalUnitsIssued:108,benefitIssuances:months}]},agency,rep);
  expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
  expect(draw.mock.calls.filter(call=>call[0]==='6 Units per month')).toHaveLength(18);
  expect(draw.mock.calls.every(call=>(call[1]?.y??0)>=26)).toBe(true);
  expect(draw.mock.calls.some(call=>call[0].includes('Monthly issuance (continued)'))).toBe(true);
  if(process.env.AUTHORIZATION_PREVIEW){const {writeFileSync}=await import('node:fs');writeFileSync('/tmp/authorization-long-schedule.pdf',pdf);}
 }finally{draw.mockRestore();}
});

it('uses singular Unit for one and plural Units for zero in the PDF panel',async()=>{
 const {PDFPage}=await import('pdf-lib');const {vi}=await import('vitest');const draw=vi.spyOn(PDFPage.prototype,'drawText');
 try{
  await createAuthorizationFormPdf({...request,totalUnitsIssued:1,localSurplusAllocations:[{lotId:'one',units:1}],benefitIssuances:[{month:'2026-11',quantity:1}]},agency,rep);
  const text=draw.mock.calls.map(call=>call[0]).join('\n');expect(text).toContain('1 Unit per month');expect(text).not.toMatch(/unit\(s\)/i);
  expect(draw.mock.calls.some(call=>call[0]==='Unit'&&call[1]?.x===522)).toBe(true);
  expect(draw.mock.calls.some(call=>call[0]==='Units'&&call[1]?.x===522)).toBe(true);
 }finally{draw.mockRestore();}
});
