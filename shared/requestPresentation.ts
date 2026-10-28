import {benefitMonthLabels} from './requestMonthSelection';
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

export function insuranceDetails(request:Partial<RequestRecord>):string {
 const label=insuranceLabel(request.medicalStatus);
 return request.medicalStatus==='yes'&&request.mediCalStatus?`${label} — ${request.mediCalStatus}`:label;
}
export function requestedMonthLabels(months?:string[]):string {
 return (months??[]).map(month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?benefitMonthLabels[Number(month.slice(-2))-1]:undefined).filter(Boolean).join(', ')||'—';
}
