export interface ParticipantAgeAlert {
    milestone: '6 months' | '12 months' | '5 years';
    date: string;
    daysUntil: number;
}
function calendarDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value ? date : undefined;
}
export function participantAgeAlerts(dob: string | undefined, referenceDate: string | undefined, daysBefore: number): ParticipantAgeAlert[] {
    const birth = calendarDate(dob);
    const reference = calendarDate(referenceDate);
    if (!birth || !reference || reference < birth || !Number.isInteger(daysBefore) || daysBefore < 0) return [];
    const milestones = [{months:6,label:'6 months'},{months:12,label:'12 months'},{months:60,label:'5 years'}] as const;
    return milestones.flatMap(milestone => {
        const date = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth() + milestone.months, 1));
        const lastDay = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth() + 1,0)).getUTCDate();
        date.setUTCDate(Math.min(birth.getUTCDate(),lastDay));
        const daysUntil = Math.round((date.getTime() - reference.getTime()) / 86400000);
        return daysUntil >= 0 && daysUntil <= daysBefore ? [{milestone:milestone.label,date:date.toISOString().slice(0,10),daysUntil}] : [];
    });
}
