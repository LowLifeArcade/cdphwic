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
    productForm: string; readyToFeedJustification: string; prescriptionSignedDate: string;
}): string {
    if (![fields.familyId, fields.individualId, fields.benefitsStartDate, fields.requestKind].every((value) => value.trim())) {
        return 'Complete all required Additional Participant Details fields.';
    }
    if (!['yes', 'no'].includes(fields.medicalStatus)) return 'Select Health Insurance.';
    if (fields.medicalStatus === 'yes' && !['Denied', 'Pending PA', 'Product Not Covered'].includes(fields.mediCalStatus)) {
        return 'Select Medi-Cal Status.';
    }
    if (fields.productForm === 'ready-to-feed' && !fields.readyToFeedJustification.trim()) {
        return 'List reasons why ready-to-feed is needed.';
    }
    if (!Number.isFinite(Number(fields.ouncesPrescribed)) || Number(fields.ouncesPrescribed) <= 0) return 'Enter Amount Per Day greater than zero.';
    if (!Number.isInteger(Number(fields.durationMonths)) || Number(fields.durationMonths) < 1 || Number(fields.durationMonths) > 6) return 'Enter Duration between 1 and 6 months.';
    if (!fields.diagnosis.trim()) return 'Add at least one Qualifying Diagnosis.';
    if (!fields.prescriptionSignedDate) return 'Enter Date Signed.';
    if (!fields.doctorHasSignedOff) return 'Confirm that the medical documentation includes the provider’s signature.';
    return '';
}
