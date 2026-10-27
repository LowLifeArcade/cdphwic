import { validateRequestedMonths } from './requestMonthSelection';
import type { RequestRecord } from './domain';
import { validateAgencyFields } from './newRequestFields';
import { validateFormulaEntry, validateFormulaSelection } from './formulaEntries';
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
    const selectionError = validateFormulaSelection(request.requestedFormulas?.map((formula) => ({ name: formula.productName, form: formula.productForm, flavor: formula.flavor })) ?? [{ name: request.productName, form: request.productForm, flavor: request.formulaFlavor }]);
    if (selectionError) return selectionError;
    for (const [index, formula] of (request.requestedFormulas ?? []).entries()) {
        const error = validateFormulaEntry({
            formulaName: formula.otherFormulaName ? 'Other' : formula.productName,
            otherFormulaName: formula.otherFormulaName ?? '', productForm: formula.productForm,
            ouncesPrescribed: formula.ouncesPrescribed, formulaFlavor: formula.flavor ?? '',
            readyToFeedJustification: formula.readyToFeedJustification ?? '',
        });
        if (error) return `Formula ${index + 1}: ${error}`;
    }
    const monthError = validateRequestedMonths(request.benefitMonthsRequested);
    if (monthError) return monthError;
    for (const item of request.surplusItems ?? []) {
        const names = request.requestedFormulas?.map((formula) => formula.productName) ?? [request.productName];
        if (!names.includes(item.productName) || !Number.isSafeInteger(item.units) || item.units <= 0) return 'Select a requested formula and enter a positive surplus quantity.';
        const surplusForms = findFormula(item.productName) ? availableFormulaForms(item.productName) : availableFormulaForms('Other');
        if (!item.productForm || !surplusForms.includes(item.productForm)) return 'Select a valid Form for each surplus entry.';
        if (item.expirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.expirationDate)) return 'Enter a valid surplus expiration date.';
    }
    return validateAgencyFields({
        formulaName: isOther ? 'Other' : request.productName,
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
