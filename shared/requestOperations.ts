import type { RequestRecord, RequestStatus } from './domain';

export function canSelectShippedStatus(request: Partial<RequestRecord>): boolean {
    return Boolean(
        (request.shippedAt || request.status === 'shipped') &&
        request.eta?.trim() &&
        request.trackingNumbers?.some((tracking) => tracking.number.trim()),
    );
}

export function getApprovalStatus(status: RequestStatus): RequestStatus {
    if (['opened', 'needs_info', 'unopened', 'denied'].includes(status)) {
        return 'in_progress';
    }

    return status;
}

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

export function canGenerateAuthorizationForm(request: Pick<RequestRecord, 'status' | 'approved' | 'dateOrdered' | 'authorizationVersions'>): boolean {
    return !!request.authorizationVersions?.length || (request.approved === true || request.status === 'approved') && Boolean(request.dateOrdered);
}

export function subsequentIssuanceMonths(issuances:BenefitIssuance[],changedIndex:number):BenefitIssuance[]{
    const rows=issuances.map(row=>({...row}));
    for(let index=changedIndex+1;index<rows.length;index++){
        const previous=rows[index-1]!.month;
        if(!previous)rows[index]!.month='';
        else if(!rows[index]!.month || rows[index]!.month<=previous)rows[index]!.month=getNextBenefitMonth(rows.slice(0,index));
    }
    return rows;
}
