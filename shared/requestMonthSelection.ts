export const benefitMonthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function toggleRequestedMonth(selected: string[], month: string) {
    if (selected.includes(month)) return selected.filter((item) => item !== month);
    if (selected.length >= 3 || !/^(?:\d{4}-)?(0[1-9]|1[0-2])$/.test(month)) return selected;
    return [...selected, month].sort();
}
export function serializeRequestedMonths(selected: string[], benefitsStartDate: string, fallbackYear: number) {
    const validStart = /^\d{4}-(0[1-9]|1[0-2])/.test(benefitsStartDate);
    const year = validStart ? Number(benefitsStartDate.slice(0, 4)) : fallbackYear;
    const startMonth = validStart ? benefitsStartDate.slice(5, 7) : '01';
    return [...new Set(selected.map((month) => /^\d{4}-/.test(month) ? month : `${year + (month < startMonth ? 1 : 0)}-${month}`))].sort();
}
export function validateRequestedMonths(months: string[] | undefined) {
    if (!months) return '';
    return months.length > 3 || new Set(months).size !== months.length || months.some((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        ? 'Select up to 3 distinct Benefit Months Requested.' : '';
}
