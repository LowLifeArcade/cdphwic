import type { ProductForm } from '#shared/domain';
import type { BreastfeedingStatus } from '#shared/breastfeeding';
export function blankRequestForm() {
    return {
        patientFirstName: '',
        patientLastName: '',
        participantDob: '',
        familyId: '',
        individualId: '',
        benefitsStartDate: '',
        requestKind: '' as '' | 'new' | 'extension',
        breastfeedingStatus: '' as '' | BreastfeedingStatus,
        breastfeedingDiscontinuedDate: '',
        formulaName: '',
        otherFormulaName: '',
        formulaFlavor: '',
        wicFoodRestrictions: '' as '' | 'under-6-months' | 'none' | 'restricted' | 'not-indicated',
        wicFoodRestrictionDetails: '',
        wicStaffFoodRestrictions: '' as '' | 'none' | 'restricted',
        wicNutritionStaffNotes: '',
        wicNutritionStaffName: '',
        productForm: '' as ProductForm | '',
        readyToFeedJustification: '',
        medicalStatus: '',
        mediCalStatus: '',
        diagnosis: '',
        ouncesPrescribed: '',
        durationMonths: '',
        doctorPrintedName: '',
        doctorHasSignedOff: false,
        doctorOfficeName: '',
        doctorOfficeAddress: '',
        doctorOfficePhone: '',
        prescriptionSignedDate: '',
        additionalNotes: '',
    };
}
export type RequestForm = ReturnType<typeof blankRequestForm>;
