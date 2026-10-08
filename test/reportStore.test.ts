import { describe, expect, it } from 'vitest';
import {
    getMasterLogExportRows,
    getMasterLogMonthlyTotals,
    getMasterLogRows,
    getMcKessonLogExportRows,
} from '../server/utils/reportStore';

describe('report store', () => {
    it('derives Master Log fields from requests and related records', () => {
        const rows = getMasterLogRows();
        const anaRow = rows.find((row) => row.familyId === '41001');

        expect(anaRow).toMatchObject({
            processedBy: 'James Kim',
            contact: 'Maria Lopez',
            formulaRequested: 'Nutramigen',
            company: 'McKesson',
        });
        expect(anaRow?.monthlyUnits['2026-10']).toBe(12);
    });

    it('provides monthly totals and export-shaped rows', () => {
        const monthlyTotals = getMasterLogMonthlyTotals();
        const masterExport = getMasterLogExportRows();
        const mckessonExport = getMcKessonLogExportRows();

        expect(monthlyTotals.find((item) => item.label === '10/1/2026')?.value).toBe(36);
        expect(masterExport[0]).toHaveProperty('Date Sent to State');
        expect(masterExport[0]).toHaveProperty('10/1/2026');
        expect(mckessonExport[0]).toMatchObject({ Formula: 'Fortini Infant 4 fl oz RTF', Cs: 11 });
    });
});
