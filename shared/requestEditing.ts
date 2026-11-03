import type { RequestRecord } from './domain';
import { blankFormula, type FormulaEntry } from './formulaEntries';
import { formatPhoneNumber } from './phone';
export const latestMoreInfoRequest=(request:Pick<RequestRecord,'moreInfoRequests'>)=>request.moreInfoRequests?.findLast(entry=>!entry.deletedAt);
export const canEditSubmission = (request: Pick<RequestRecord, 'status' | 'openedAt' | 'moreInfoRequests'>) =>
    (request.status === 'unopened' && !request.openedAt && !request.moreInfoRequests?.length) || (hasPendingMoreInfo(request) && latestMoreInfoRequest(request)?.resubmissionOpen===true);
export const canReplyToMoreInfo=(request:Pick<RequestRecord,'status'|'moreInfoRequests'>,noteId:string)=>['needs_info','unopened','opened','in_progress'].includes(request.status) && !!request.moreInfoRequests?.some(entry=>entry.id===noteId&&!entry.deletedAt&&!entry.resolvedAt);
export const canReopenMoreInfo=(request:Pick<RequestRecord,'status'|'moreInfoRequests'>)=>['needs_info','unopened','opened','in_progress','approved'].includes(request.status) && !!latestMoreInfoRequest(request) && !latestMoreInfoRequest(request)?.resolvedAt && !latestMoreInfoRequest(request)?.resubmissionOpen;
export const canResolveMoreInfo=(request:Pick<RequestRecord,'status'|'moreInfoRequests'>)=>{
 const latest=latestMoreInfoRequest(request);
 return ['needs_info','unopened','opened','in_progress'].includes(request.status) && !!latest && !latest.resolvedAt && !!latest.responses?.some(response=>response.respondedAs!=='reviewer');
};
export const hasPendingMoreInfo=(request:Pick<RequestRecord,'status'|'moreInfoRequests'>)=>{
 const latest=latestMoreInfoRequest(request);
 return request.status==='needs_info' && !!latest && (!latest.resubmittedAt || latest.resubmissionOpen===true) && !latest.resolvedAt;
};
export const submissionFieldKeys = [
    'shipping',
    'participantName',
    'participantFirstName',
    'participantLastName',
    'participantDob',
    'participantFamilyId',
    'wicIndividualId',
    'benefitsStartDate',
    'benefitMonthsRequested',
    'requestKind',
    'breastfeedingStatus',
    'breastfeedingDiscontinuedDate',
    'productId',
    'productName',
    'requestedFormulas',
    'productForm',
    'formulaFlavor',
    'wicFoodRestrictions',
    'wicFoodRestrictionDetails',
    'wicStaffFoodRestrictions',
    'wicNutritionStaffNotes',
    'wicNutritionStaffName',
    'medicalStatus',
    'mediCalStatus',
    'diagnosis',
    'ouncesPrescribed',
    'durationMonths',
    'doctorPrintedName',
    'doctorHasSignedOff',
    'doctorOfficeName',
    'doctorOfficeAddress',
    'doctorOfficePhone',
    'prescriptionSignedDate',
    'genericFields',
    'surplusItems',
] as const satisfies readonly (keyof RequestRecord)[];
export function submissionFields(input: Partial<RequestRecord>): Partial<RequestRecord> {
    return Object.fromEntries(submissionFieldKeys.filter((key) => key in input).map((key) => [key, input[key]]));
}
export function restoreSubmittedForm(request: RequestRecord) {
    const formulas: FormulaEntry[] = (
        request.requestedFormulas?.length
            ? request.requestedFormulas
            : [
                  {
                      productName: request.productName,
                      productForm: request.productForm!,
                      ouncesPrescribed: request.ouncesPrescribed ?? 0,
                      flavor: request.formulaFlavor,
                      otherFormulaName: request.genericFields?.otherFormulaName,
                      readyToFeedJustification: request.genericFields?.readyToFeedJustification,
                  },
              ]
    ).map((f) => ({
        ...blankFormula(),
        formulaName: f.otherFormulaName ? 'Other' : f.productName,
        otherFormulaName: f.otherFormulaName ?? '',
        productForm: f.productForm ?? '',
        ouncesPrescribed: String(f.ouncesPrescribed ?? ''),
        formulaFlavor: f.flavor ?? '',
        readyToFeedJustification: f.readyToFeedJustification ?? '',
    }));
    const [firstName, ...lastName] = request.participantName.split(/\s+/);
    return {
        form: {
            ...formulas[0],
            patientFirstName: request.participantFirstName ?? firstName ?? '',
            patientLastName: request.participantLastName ?? lastName.join(' '),
            participantDob: request.participantDob ?? '',
            familyId: String(request.participantFamilyId ?? ''),
            individualId: request.wicIndividualId ?? '',
            benefitsStartDate: request.benefitsStartDate ?? '',
            requestKind: request.requestKind ?? '',
            breastfeedingStatus: request.breastfeedingStatus ?? '',
            breastfeedingDiscontinuedDate: request.breastfeedingDiscontinuedDate ?? '',
            medicalStatus: request.medicalStatus === 'pending' ? '' : (request.medicalStatus ?? ''),
            mediCalStatus: request.mediCalStatus ?? '',
            diagnosis: request.diagnosis ?? '',
            durationMonths: String(request.durationMonths ?? ''),
            wicFoodRestrictions: request.wicFoodRestrictions ?? '',
            wicFoodRestrictionDetails: request.wicFoodRestrictionDetails ?? '',
            wicStaffFoodRestrictions: request.wicStaffFoodRestrictions ?? '',
            wicNutritionStaffNotes: request.wicNutritionStaffNotes ?? '',
            wicNutritionStaffName: request.wicNutritionStaffName ?? '',
            doctorPrintedName: request.doctorPrintedName ?? '',
            doctorHasSignedOff: request.doctorHasSignedOff ?? false,
            doctorOfficeName: request.doctorOfficeName ?? '',
            doctorOfficeAddress: request.doctorOfficeAddress ?? '',
            doctorOfficePhone: formatPhoneNumber(request.doctorOfficePhone ?? ''),
            prescriptionSignedDate: request.prescriptionSignedDate ?? '',
            additionalNotes: request.genericFields?.additionalNotes ?? '',
        },
        shipping: request.shipping,
        additionalFormulas: formulas.slice(1),
        surplusEntries: (request.surplusItems ?? []).map((e) => ({
            ...e,
            productForm: e.productForm ?? '',
            flavor: e.flavor ?? '',
            expirationDate: e.expirationDate ?? '',
        })),
        requestedMonths: [...(request.benefitMonthsRequested ?? [])],
    };
}
