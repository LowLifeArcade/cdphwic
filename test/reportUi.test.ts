import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reports UI', () => {
    it('renders both report tables and download actions', () => {
        const reports = readFileSync(new URL('../app/pages/reports.vue', import.meta.url), 'utf8');

        expect(reports).toContain('Master Log');
        expect(reports).toContain('McKesson Log');
        expect(reports).toContain('/api/reports/master-log.xlsx');
        expect(reports).toContain('/api/reports/mckesson-log.csv');
        expect(reports).toContain('table-data-bar');
    });
});
