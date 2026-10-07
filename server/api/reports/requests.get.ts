import * as XLSX from 'xlsx';
import { getAllRequests } from '../../utils/requestStore';

export default defineEventHandler((event) => {
    const rows = getAllRequests().map((request) => ({
        Request: request.id,
        Participant: request.participantName,
        Product: request.productName,
        Status: request.status,
        Submission: request.submissionDate ?? '',
        Approval: request.approvalDate ?? '',
        Denial: request.denialDate ?? '',
        ETA: request.eta ?? '',
        Units: request.unitsRequested ?? '',
        Tracking: request.trackingNumber ?? '',
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Requests');
    const file = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', 'attachment; filename="cdphwic-requests.xlsx"');
    return file;
});
