export const breastfeedingOptions = ['Fully BF', 'Never BF', 'Breastmilk + Formula', 'Discontinued BF'] as const;
export type BreastfeedingStatus = (typeof breastfeedingOptions)[number];
export function validateBreastfeeding(input: {breastfeedingStatus?: string; breastfeedingDiscontinuedDate?: string}) {
    if (!input.breastfeedingStatus) return '';
    if (!breastfeedingOptions.includes(input.breastfeedingStatus as BreastfeedingStatus)) return 'Select a valid Breastfeeding option.';
    if (input.breastfeedingStatus !== 'Discontinued BF') return '';
    const value = input.breastfeedingDiscontinuedDate;
    if (!value) return 'Enter Date BF Discontinued.';
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value) return 'Enter a valid Date BF Discontinued.';
    return '';
}
