import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AgencyMemberRecord, AgencyRecord, RequestRecord } from '../../shared/domain';

function formatDate(value?: string) {
    if (!value) {
        return '—';
    }
    const [year, month, day] = value.split('-');
    return year && month && day ? `${month}/${day}/${year}` : value;
}

function value(value?: string | number) {
    return value === undefined || value === '' ? '—' : String(value);
}

export async function createAuthorizationFormPdf(
    request: RequestRecord,
    agency?: AgencyRecord,
    rep?: AgencyMemberRecord,
): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const page = document.addPage([612, 792]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let y = 744;

    const heading = (text: string) => {
        page.drawText(text, { x: 48, y, size: 16, font: bold, color: rgb(0.08, 0.16, 0.24) });
        y -= 28;
    };
    const section = (text: string) => {
        y -= 10;
        page.drawText(text, { x: 48, y, size: 11, font: bold, color: rgb(0.12, 0.35, 0.42) });
        y -= 18;
    };
    const row = (label: string, text: string) => {
        page.drawText(`${label}:`, { x: 52, y, size: 9, font: bold, color: rgb(0.2, 0.24, 0.28) });
        page.drawText(text, { x: 190, y, size: 9, font: regular, color: rgb(0.12, 0.14, 0.16) });
        y -= 15;
    };

    page.drawText('CDPH WIC', { x: 48, y, size: 10, font: bold, color: rgb(0.12, 0.35, 0.42) });
    y -= 24;
    heading('Authorization Form');
    page.drawText(`Request #${request.id}`, { x: 48, y, size: 10, font: regular });
    y -= 20;

    section('Request');
    row('Request type', request.requestKind === 'extension' ? 'Extension' : 'New');
    row('Submitted', formatDate(request.submissionDate));
    row('Approved', formatDate(request.approvalDate));
    row('Product ordered', formatDate(request.dateOrdered));
    row('Formula', value(request.productName));
    row('Formula form', value(request.productForm));
    row('Amount prescribed', request.ouncesPrescribed ? `${request.ouncesPrescribed} oz` : '—');
    row('Duration', request.durationMonths ? `${request.durationMonths} months` : '—');

    section('Participant');
    row('Name', value(request.participantName));
    row('Date of birth', formatDate(request.participantDob));
    row('WIC family ID', value(request.participantFamilyId));
    row('WIC individual ID', value(request.wicIndividualId));
    row('Benefits start', formatDate(request.benefitsStartDate));
    row('Diagnosis', value(request.diagnosis));

    section('Local agency and representative');
    row('Agency', value(agency?.name));
    row('Address', agency ? `${agency.shippingAddress}, ${agency.city}, ${agency.state} ${agency.postalCode}` : '—');
    row('Representative', value(rep?.name));
    row('Email', value(rep?.email));
    row('Phone', value(rep?.phone));

    section('Prescription');
    row('Doctor', value(request.doctorPrintedName));
    row('Office', value(request.doctorOfficeName));
    row('Office address', value(request.doctorOfficeAddress));
    row('Office phone', value(request.doctorOfficePhone));
    row('Signed date', formatDate(request.prescriptionSignedDate));

    section('Benefit issuance');
    if (request.benefitIssuances?.length) {
        request.benefitIssuances.forEach((issuance) => row(issuance.month, `${issuance.quantity} units`));
    } else {
        row('Allocations', '—');
    }

    y -= 12;
    page.drawText('Generated from the approved and ordered request record.', {
        x: 48,
        y,
        size: 8,
        font: regular,
        color: rgb(0.4, 0.43, 0.46),
    });

    return document.save();
}
