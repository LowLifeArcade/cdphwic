import type { RequestRecord } from './domain';
import { validateAgencyFields } from './newRequestFields';
import { availableFormulaForms, findFormula } from './formulaCatalog';
import { normalizePhoneNumber } from './phone';

export function validateRequestSubmission(request: Partial<RequestRecord>) {
    if (!request.participantFirstName?.trim() || !request.participantLastName?.trim() || !request.participantDob) return 'Complete the patient name and Date of Birth.';
    if (!request.doctorPrintedName?.trim() || !request.doctorOfficeName?.trim() || !request.doctorOfficeAddress?.trim()) return 'Complete Health Care Provider information.';
    if (!normalizePhoneNumber(request.doctorOfficePhone ?? '')) return 'Enter a valid Phone Number.';
    const customName = request.genericFields?.otherFormulaName?.trim();
    const isOther = Boolean(customName && customName === request.productName?.trim() && customName.toLowerCase() !== 'other' && !findFormula(customName));
    const forms = availableFormulaForms(isOther ? 'Other' : request.productName ?? '');
    if (!request.productName?.trim() || (!isOther && !findFormula(request.productName)) || !request.productForm || !forms.includes(request.productForm)) return 'Select a matching Formula Name and Form.';
    return validateAgencyFields({
        familyId: request.participantFamilyId ? String(request.participantFamilyId) : '',
        individualId: request.wicIndividualId ?? '', benefitsStartDate: request.benefitsStartDate ?? '',
        requestKind: request.requestKind ?? '', medicalStatus: request.medicalStatus ?? '', mediCalStatus: request.mediCalStatus ?? '',
        doctorHasSignedOff: request.doctorHasSignedOff ?? false,
        ouncesPrescribed: request.ouncesPrescribed ?? '', durationMonths: request.durationMonths ?? '', diagnosis: request.diagnosis ?? '',
        productForm: request.productForm, readyToFeedJustification: request.genericFields?.readyToFeedJustification ?? '',
        prescriptionSignedDate: request.prescriptionSignedDate ?? '',
        wicFoodRestrictions: request.wicFoodRestrictions ?? '', wicStaffFoodRestrictions: request.wicStaffFoodRestrictions ?? '',
        wicNutritionStaffNotes: request.wicNutritionStaffNotes ?? '', wicNutritionStaffName: request.wicNutritionStaffName ?? '',
    });
}
