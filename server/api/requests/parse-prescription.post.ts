import type { ProductForm } from '../../../shared/domain';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'prescription');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Upload a prescription PDF or image first.' });
    }

    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (file.type && !supportedTypes.includes(file.type)) {
        throw createError({ statusCode: 400, statusMessage: 'Use a PDF, JPG, PNG, or WEBP prescription.' });
    }

    return {
        status: 'needs_review' as const,
        message: 'Prescription received. Connect the AI extraction provider to populate these fields automatically.',
        extracted: {
            patientFirstName: '',
            patientLastName: '',
            participantDob: '',
            formulaName: '',
            formulaForm: undefined as ProductForm | undefined,
            ouncesPrescribed: undefined as number | undefined,
            durationMonths: undefined as number | undefined,
            doctorPrintedName: '',
            doctorSignature: '',
            doctorOfficeName: '',
            doctorOfficeAddress: '',
            doctorOfficePhone: '',
            prescriptionSignedDate: '',
        },
        missing: [
            'Patient first name',
            'Patient last name',
            'Date of birth',
            'Formula name',
            'Formula form',
            'Ounces prescribed',
            'Duration in months',
            'Doctor printed name',
            'Doctor signature',
            'Doctor office information',
            'Prescription signed date',
        ],
    };
});
