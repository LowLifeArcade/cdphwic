import { describe, expect, it } from 'vitest';
import { benefitMonthLabels, toggleRequestedMonth, serializeRequestedMonths, validateRequestedMonths } from '../shared/requestMonthSelection';

describe('requested benefit months', () => {
    it('shows twelve three-letter uppercase month names', () => {
        expect(benefitMonthLabels).toEqual(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']);
    });
    it('limits selections to three and permits changing selected months', () => {
        expect(toggleRequestedMonth(['01', '02', '03'], '04')).toEqual(['01', '02', '03']);
        expect(toggleRequestedMonth(['01', '02', '03'], '02')).toEqual(['01', '03']);
        expect(toggleRequestedMonth(['01', '03'], '12')).toEqual(['01', '03', '12']);
    });
    it('assigns months before the benefits start month to the next year', () => {
        expect(serializeRequestedMonths(['11', '12', '01'], '2026-11-01', 2026)).toEqual(['2026-11', '2026-12', '2027-01']);
        expect(serializeRequestedMonths(['2025-11', '2025-12', '2026-01'], '2026-11-01', 2026)).toEqual(['2025-11', '2025-12', '2026-01']);
        expect(toggleRequestedMonth(['2026-11', '2026-12'], '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
    });
    it('saves months in the benefits start year using the existing date format', () => {
        expect(serializeRequestedMonths(['12', '01'], '2027-01-15', 2026)).toEqual(['2027-01', '2027-12']);
        expect(validateRequestedMonths(['2026-01', '2026-02', '2026-03', '2026-04'])).not.toBe('');
        expect(validateRequestedMonths(['2026-01', '2026-01'])).not.toBe('');
        expect(validateRequestedMonths(['2026-13'])).not.toBe('');
        expect(validateRequestedMonths(['2026-01', '2026-02'])).toBe('');
    });
});
