import { benefitMonthLabels } from './requestMonthSelection';
import { findFormula } from './formulaCatalog';
import type { RequestRecord, RequestedFormula } from './domain';
export function requestFormulas(request: Partial<RequestRecord>): RequestedFormula[] {
    return request.requestedFormulas?.length
        ? request.requestedFormulas
        : [
              {
                  productName: request.productName ?? '',
                  productForm: request.productForm!,
                  ouncesPrescribed: request.ouncesPrescribed!,
                  flavor: request.formulaFlavor,
                  otherFormulaName: request.genericFields?.otherFormulaName,
                  readyToFeedJustification: request.genericFields?.readyToFeedJustification,
              },
          ];
}
export function participantNames(request: Partial<RequestRecord>) {
    const [first, ...last] = (request.participantName ?? '').trim().split(/\s+/);
    return { first: request.participantFirstName ?? first ?? '', last: request.participantLastName ?? last.join(' ') };
}
export function insuranceLabel(value?: RequestRecord['medicalStatus']) {
    return value === 'yes' ? 'Medi-Cal' : value === 'no' ? 'Private Insurance' : value === 'pending' ? 'Pending' : '—';
}
export function foodRestrictionLabel(value?: RequestRecord['wicFoodRestrictions']) {
    return value
        ? ({
              'under-6-months': 'Participant is under 6 months',
              none: 'No food restrictions (all WIC foods allowed)',
              restricted: 'Food restrictions (see medical documentation)',
              'not-indicated': 'Neither box checked by HCP',
          }[value] ?? '—')
        : '—';
}
export function formulaFormLabel(value?: string) {
    return value
        ? ({ powder: 'Powder', concentrate: 'Liquid Concentrate', 'ready-to-feed': 'Ready-to-Feed' }[value] ?? value)
        : '—';
}

export function formulaOverviewUpdates(draft: Partial<RequestRecord>): Partial<RequestRecord> {
    const name = draft.productName?.trim() ?? '';
    const otherName = name && !findFormula(name) ? name : undefined;
    const genericFields = { ...draft.genericFields, otherFormulaName: otherName ?? '' };
    return {
        productName: name,
        productForm: draft.productForm,
        formulaFlavor: draft.formulaFlavor,
        ouncesPrescribed: Number(draft.ouncesPrescribed),
        durationMonths: Number(draft.durationMonths),
        diagnosis: draft.diagnosis,
        genericFields,
        requestedFormulas: [
            {
                ...requestFormulas(draft)[0]!,
                productName: name,
                otherFormulaName: otherName,
                productForm: draft.productForm!,
                ouncesPrescribed: Number(draft.ouncesPrescribed),
                flavor: draft.formulaFlavor,
                readyToFeedJustification: genericFields.readyToFeedJustification,
            },
            ...requestFormulas(draft).slice(1),
        ],
    };
}

export function insuranceDetails(request: Partial<RequestRecord>): string {
    const label = insuranceLabel(request.medicalStatus);
    return request.medicalStatus === 'yes' && request.mediCalStatus ? `${label} (${request.mediCalStatus})` : label;
}
export function requestedMonthLabels(months?: string[]): string {
    return (
        (months ?? [])
            .map((month) =>
                /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? benefitMonthLabels[Number(month.slice(-2)) - 1] : undefined,
            )
            .filter(Boolean)
            .join(', ') || '—'
    );
}

export function providerAddressLines(value?: string): string[] {
    const address = (value ?? '').trim();
    if (!address) return ['—'];
    const locality = /(?:,|\n)\s*([^,\n]+?)(?:,\s*|\s+)([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/.exec(address);
    if (locality) {
        const street = address
            .slice(0, locality.index)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(', ');
        return [street, `${locality[1]!.trim()}, ${locality[2]!.toUpperCase()} ${locality[3]}`].filter(Boolean);
    }
    return address
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

export function submissionDateOnly(value?: string): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
