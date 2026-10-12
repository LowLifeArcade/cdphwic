import type { RequestRecord } from './domain';

type DetailNumbers = Pick<
    RequestRecord,
    'approvedCases' | 'approvedMonths' | 'casesOrdered' | 'expectedSurplus' | 'agencyUnitsOnHand'
>;
type SurplusItem = NonNullable<RequestRecord['surplusItems']>[number];

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeRequestedMonths(months: string[] | undefined): string[] {
    return [...new Set((months ?? []).filter((month) => monthPattern.test(month)))].sort();
}

export function validateRequestDetailNumbers(values: DetailNumbers): string[] {
    const labels: Array<[keyof DetailNumbers, string]> = [
        ['approvedCases', 'Approved cases'],
        ['approvedMonths', 'Approved months'],
        ['casesOrdered', 'Cases ordered'],
        ['expectedSurplus', 'Expected surplus'],
        ['agencyUnitsOnHand', 'Agency units on hand'],
    ];
    for (const [key, label] of labels) {
        const value = values[key];
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
            return [`${label} cannot be negative.`];
        }
    }
    return [];
}

export function validateSurplusItems(items: SurplusItem[]): string[] {
    if (
        items.some(
            (item) =>
                !item.productName.trim() ||
                !item.expirationDate ||
                !Number.isFinite(item.units) ||
                item.units < 0,
        )
    ) {
        return ['Each surplus row needs a product, number of units, and expiration date.'];
    }
    return [];
}
