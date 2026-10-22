export function addDiagnosis(diagnoses: string[], value: string): string[] {
    const diagnosis = value.trim();
    return !diagnosis || diagnoses.some((item) => item.toLowerCase() === diagnosis.toLowerCase())
        ? diagnoses
        : [...diagnoses, diagnosis];
}

export function validateAgencyFields(fields: {
    familyId: string; individualId: string; benefitsStartDate: string; requestKind: string;
    medicalStatus: string; mediCalStatus: string; doctorHasSignedOff: boolean;
    productForm: string; readyToFeedJustification: string;
}): string {
    if (![fields.familyId, fields.individualId, fields.benefitsStartDate, fields.requestKind].every((value) => value.trim())) {
        return 'Complete all required Local Agency Information fields.';
    }
    if (!['yes', 'no'].includes(fields.medicalStatus)) return 'Select Health Insurance.';
    if (fields.medicalStatus === 'yes' && !['Denied', 'Pending PA', 'Product Not Covered'].includes(fields.mediCalStatus)) {
        return 'Select Medi-Cal Status.';
    }
    if (fields.productForm === 'ready-to-feed' && !fields.readyToFeedJustification.trim()) {
        return 'List reasons why ready-to-feed is needed.';
    }
    if (!fields.doctorHasSignedOff) return 'Confirm that the medical documentation includes the provider’s signature.';
    return '';
}
