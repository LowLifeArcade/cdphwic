import type { RequestRecord, ProductForm } from '#shared/domain';
import { normalizePhoneNumber } from '#shared/phone';
import type { RequestForm } from './requestForm';
export interface SubmissionContext {
    draftId?: number;
    revision: number;
    removePrescriptionAttachment: boolean;
    submissionId: string;
    agencyId: number;
    agencyMemberId?: number;
    shipping: RequestRecord['shipping'];
    benefitMonthsRequested: string[];
    productId?: number;
    productName: string;
    requestedFormulas: RequestRecord['requestedFormulas'];
    surplusItems: Array<{
        productName: string;
        productForm: ProductForm | '';
        flavor: string;
        packaging?: string;
        units: string | number;
        expirationDate: string;
        clinicId?: string;
    }>;
    hasFlavor?: boolean;
    isOtherFormula: boolean;
    prescriptionKey: string;
}
export function requestSubmissionBody(form: RequestForm, context: SubmissionContext, saveOnly = false) {
    const participantName = `${form.patientFirstName} ${form.patientLastName}`.trim();
    const body = new FormData();
    body.append(
        'request',
        JSON.stringify({
            saveOnly,
            draftId: context.draftId,
            revision: context.revision,
            removePrescriptionAttachment: context.removePrescriptionAttachment,
            submissionId: context.submissionId,
            agencyId: context.agencyId,
            agencyMemberId: context.agencyMemberId,
            shipping: context.shipping,
            participantName,
            participantFirstName: form.patientFirstName,
            participantLastName: form.patientLastName,
            participantDob: form.participantDob,
            participantFamilyId: Number(form.familyId) || undefined,
            wicIndividualId: form.individualId || undefined,
            benefitsStartDate: form.benefitsStartDate,
            benefitMonthsRequested: context.benefitMonthsRequested,
            requestKind: form.requestKind,
            breastfeedingStatus: form.breastfeedingStatus,
            breastfeedingDiscontinuedDate:
                form.breastfeedingStatus === 'Discontinued BF' ? form.breastfeedingDiscontinuedDate : '',
            productId: context.productId ?? -1,
            productName: context.productName,
            requestedFormulas: context.requestedFormulas,
            surplusItems: context.surplusItems.map((entry) => ({
                ...entry,
                units: Number(entry.units),
            })),
            productForm: form.productForm,
            formulaFlavor: context.hasFlavor ? form.formulaFlavor.trim() : undefined,
            wicFoodRestrictions: form.wicFoodRestrictions || undefined,
            wicFoodRestrictionDetails: form.wicFoodRestrictions === 'restricted' ? form.wicFoodRestrictionDetails : '',
            wicStaffFoodRestrictions:
                form.wicFoodRestrictions === 'not-indicated' ? form.wicStaffFoodRestrictions || undefined : undefined,
            wicNutritionStaffNotes:
                form.wicFoodRestrictions === 'not-indicated' && form.wicStaffFoodRestrictions === 'restricted'
                    ? form.wicNutritionStaffNotes
                    : '',
            wicNutritionStaffName: form.wicNutritionStaffName,
            medicalStatus: form.medicalStatus,
            mediCalStatus: form.medicalStatus === 'yes' ? form.mediCalStatus : undefined,
            diagnosis: form.diagnosis,
            ouncesPrescribed: Number(form.ouncesPrescribed),
            durationMonths: Number(form.durationMonths),
            doctorPrintedName: form.doctorPrintedName,
            doctorHasSignedOff: form.doctorHasSignedOff,
            doctorOfficeName: form.doctorOfficeName,
            doctorOfficeAddress: form.doctorOfficeAddress,
            doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone),
            prescriptionSignedDate: form.prescriptionSignedDate,
            prescriptionKey: context.prescriptionKey || undefined,
            status: 'unopened',
            genericFields: {
                otherFormulaName: context.isOtherFormula ? form.otherFormulaName.trim() : '',
                readyToFeedJustification: form.readyToFeedJustification,
                additionalNotes: form.additionalNotes,
            },
        }),
    );
    return body;
}
