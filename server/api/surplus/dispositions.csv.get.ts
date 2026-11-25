import { createError, defineEventHandler, getQuery } from 'h3';
import { listSurplusDispositions } from '../../utils/surplusDisposalReport';
import { csvResponse } from '../../utils/reportExport';
import { surplusContext } from '../../utils/surplusContext';

function spreadsheetText(value: string): string {
    return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function dateQuery(value: unknown, name: string): string | undefined {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `Enter a valid ${name} date.` });
    return value;
}

export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const query = getQuery(event);
    const rows = await listSurplusDispositions(db, user, dateQuery(query.from, 'start'), dateQuery(query.to, 'end'));
    return csvResponse(event, rows.map((row) => ({
        'Event Date': spreadsheetText(row.event_date || 'Date not recorded'),
        Activity: spreadsheetText(row.kind),
        Quantity: row.quantity,
        Formula: spreadsheetText(row.formula_name),
        Form: spreadsheetText(row.form),
        Flavor: spreadsheetText(row.flavor),
        Package: spreadsheetText(row.packaging),
        'Expiration Date': spreadsheetText(row.expiration_date),
        Agency: spreadsheetText(row.agency_name),
        Clinic: spreadsheetText(row.clinic_name || 'Not specified'),
        'Staff Attesting': spreadsheetText(row.staff_name),
        'Recorded By': spreadsheetText(row.recorded_by),
        'Recorded At': spreadsheetText(row.recorded_at),
        ...(row.corrected ? { 'Original Quantity': row.original_quantity, Corrected: spreadsheetText('Yes') } : {}),
    })), 'surplus-disposals.csv');
});
