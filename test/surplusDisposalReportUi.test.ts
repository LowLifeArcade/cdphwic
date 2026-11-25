import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('surplus disposal report UI', () => {
    it('provides date filters, disposal results, empty state, and a filtered CSV download', () => {
        const page = readFileSync(new URL('../app/pages/surplus-dispositions.vue', import.meta.url), 'utf8');

        expect(page).toContain('Donation &amp; Destruction Report');
        expect(page).toContain('type="date"');
        expect(page).toContain('Search');
        expect(page).toContain('/api/surplus/dispositions');
        expect(page).toContain('/api/surplus/dispositions.csv');
        for (const column of ['Event Date', 'Activity', 'Quantity', 'Formula', 'Agency', 'Clinic', 'Staff Attesting', 'Recorded By', 'Recorded At']) {
            expect(page).toContain(column);
        }
        expect(page).toContain('No donations or destructions match this date range.');
        expect(page).toContain('Date not recorded');
    });
});
