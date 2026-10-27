export const benefitMonthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function toggleRequestedMonth(selected: string[], month: string) {
    if (selected.includes(month)) return selected.filter((item) => item !== month);
    if (selected.length >= 3 || !/^(0[1-9]|1[0-2])$/.test(month)) return selected;
    return [...selected, month].sort();
}
export function serializeRequestedMonths(selected: string[], benefitsStartDate: string, fallbackYear: number) {
    const year = /^\d{4}-/.test(benefitsStartDate) ? benefitsStartDate.slice(0, 4) : String(fallbackYear);
    return [...new Set(selected)].sort().map((month) => `${year}-${month}`);
}
export function validateRequestedMonths(months: string[] | undefined) {
    if (!months) return '';
    return months.length > 3 || new Set(months).size !== months.length || months.some((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        ? 'Select up to 3 distinct Benefit Months Requested.' : '';
}
