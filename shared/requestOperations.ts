import type { RequestRecord } from './domain';

type BenefitIssuance = NonNullable<RequestRecord['benefitIssuances']>[number];

export function validateBenefitIssuances(issuances: BenefitIssuance[]): string[] {
    const errors: string[] = [];
    const months = issuances.map((issuance) => issuance.month);

    if (issuances.some((issuance) => !issuance.month)) {
        errors.push('Each benefit row needs a month.');
    }
    if (issuances.some((issuance) => !Number.isFinite(issuance.quantity) || issuance.quantity <= 0)) {
        errors.push('Each month needs a positive quantity.');
    }
    if (new Set(months).size !== months.length) {
        errors.push('Benefit months must be unique.');
    }
    if (months.some((month, index) => index > 0 && month <= months[index - 1])) {
        errors.push('Benefit months must be in chronological order.');
    }

    return errors;
}

export function getNextBenefitMonth(issuances: BenefitIssuance[]): string {
    const latestMonth = issuances.at(-1)?.month;
    if (!latestMonth) {
        return '';
    }

    const [year, month] = latestMonth.split('-').map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function canGenerateAuthorizationForm(request: Pick<RequestRecord, 'status' | 'dateOrdered'>): boolean {
    return request.status === 'approved' && Boolean(request.dateOrdered);
}
