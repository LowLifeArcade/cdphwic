import { requiresReadyToFeedReason } from './formulaCatalog';
import { validateDiagnoses } from './diagnosisCatalog';
export const providerSignatureMessage = 'Please verify that medical documentation is signed by a health care provider with prescriptive authority.';
export function addDiagnosis(diagnoses: string[], value: string): string[] {
    const diagnosis = value.trim();
    return !diagnosis || diagnoses.some((item) => item.toLowerCase() === diagnosis.toLowerCase())
        ? diagnoses
        : [...diagnoses, diagnosis];
}

export function validateAgencyFields(fields: {
    familyId: string; individualId: string; benefitsStartDate: string; requestKind: string;
    medicalStatus: string; mediCalStatus: string; doctorHasSignedOff: boolean;
    ouncesPrescribed: string | number; durationMonths: string | number; diagnosis: string;
    wicFoodRestrictions: string; wicStaffFoodRestrictions: string; wicNutritionStaffNotes: string; wicNutritionStaffName: string;
    formulaName: string;
    productForm: string; readyToFeedJustification: string; prescriptionSignedDate: string;
}): string {
    if (![fields.familyId, fields.individualId, fields.benefitsStartDate, fields.requestKind].every((value) => value.trim())) {
        return 'Complete all required Additional Participant Details fields.';
    }
    if (!['yes', 'no'].includes(fields.medicalStatus)) return 'Select Health Insurance.';
    if (fields.medicalStatus === 'yes' && !['Denied', 'Pending PA', 'Product Not Covered'].includes(fields.mediCalStatus)) {
        return 'Select Medi-Cal Status.';
    }
    if (requiresReadyToFeedReason(fields.formulaName, fields.productForm) && !fields.readyToFeedJustification.trim()) {
        return 'List reason(s) why ready-to-feed is needed.';
    }
    if (!Number.isFinite(Number(fields.ouncesPrescribed)) || Number(fields.ouncesPrescribed) <= 0) return 'Enter Amount Per Day greater than zero.';
    if (!Number.isInteger(Number(fields.durationMonths)) || Number(fields.durationMonths) < 1 || Number(fields.durationMonths) > 6) return 'Enter Duration between 1 and 6 months.';
    const diagnosisError = validateDiagnoses(fields.diagnosis);
    if (diagnosisError) return diagnosisError;
    if (!['under-6-months', 'none', 'restricted', 'not-indicated'].includes(fields.wicFoodRestrictions)) return 'Select WIC Food Restrictions.';
    if (fields.wicFoodRestrictions === 'not-indicated') {
        if (!['none', 'restricted'].includes(fields.wicStaffFoodRestrictions)) return 'WIC Nutrition Staff must select a food restriction option.';
        if (!fields.wicNutritionStaffName.trim()) return 'Enter WIC Nutrition Staff Name.';
        if (fields.wicStaffFoodRestrictions === 'restricted' && !fields.wicNutritionStaffNotes.trim()) return 'Enter WIC Nutrition Staff Notes listing food restrictions.';
    }
    if (!fields.prescriptionSignedDate) return 'Enter Date Signed.';
    if (!fields.doctorHasSignedOff) return providerSignatureMessage;
    return '';
}
