import {expect,it} from 'vitest';
import {participantAgeAlerts} from '../shared/participantAgeAlerts';

it('alerts at the chosen lead-time boundary for all three milestones', () => {
    expect(participantAgeAlerts('2026-01-01','2026-06-01',30)).toEqual([{milestone:'6 months',date:'2026-07-01',daysUntil:30}]);
    expect(participantAgeAlerts('2026-01-01','2026-05-31',30)).toEqual([]);
    expect(participantAgeAlerts('2025-01-01','2025-12-18',14)).toEqual([{milestone:'12 months',date:'2026-01-01',daysUntil:14}]);
    expect(participantAgeAlerts('2021-01-01','2025-12-02',30)).toEqual([{milestone:'5 years',date:'2026-01-01',daysUntil:30}]);
});
it('includes the milestone day and excludes dates after the milestone', () => {
    expect(participantAgeAlerts('2026-01-01','2026-07-01',30)[0]?.daysUntil).toBe(0);
    expect(participantAgeAlerts('2026-01-01','2026-07-02',30)).toEqual([]);
});
it('handles month ends, leap birthdays, and invalid dates', () => {
    expect(participantAgeAlerts('2024-08-31','2025-02-28',1)[0]?.date).toBe('2025-02-28');
    expect(participantAgeAlerts('2024-02-29','2025-02-28',1)[0]?.milestone).toBe('12 months');
    expect(participantAgeAlerts('2026-02-30','2026-07-01',30)).toEqual([]);
    expect(participantAgeAlerts(undefined,'2026-07-01',30)).toEqual([]);
    expect(participantAgeAlerts('2026-01-01','2025-12-31',30)).toEqual([]);
});
