import * as XLSX from 'xlsx';

export function csvResponse(event: H3Event, rows: Record<string, unknown>[], filename: string) {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
}

export function xlsxResponse(event: H3Event, rows: Record<string, unknown>[], sheetName: string, filename: string) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
    const file = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    return file;
}
