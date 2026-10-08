import type { ProductForm } from '../../../shared/domain';
import {
    MAX_PRESCRIPTION_BYTES,
    getPrescriptionContentType,
    hasValidPrescriptionSignature,
    storeTemporaryPrescriptionAttachment,
} from '../../utils/prescriptionStorage';
import { extractPrescriptionFields } from '../../utils/prescriptionParser';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((part) => part.name === 'prescription');
    if (!file?.data) {
        throw createError({ statusCode: 400, statusMessage: 'Upload a prescription PDF or image first.' });
    }

    const contentType = getPrescriptionContentType(file.type, file.filename);
    if (!contentType) {
        throw createError({ statusCode: 400, statusMessage: 'Use a PDF, JPG, PNG, or WEBP prescription.' });
    }
    if (file.data.byteLength > MAX_PRESCRIPTION_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'Prescription files must be 10 MB or smaller.' });
    }
    if (!hasValidPrescriptionSignature(file.data, contentType)) {
        throw createError({ statusCode: 400, statusMessage: 'The uploaded file does not match its declared PDF or image type.' });
    }

    const isPdf = contentType === 'application/pdf';
    const environment = event.context.cloudflare?.env as Env | undefined;
    if (!environment?.PRESCRIPTIONS) {
        throw createError({ statusCode: 503, statusMessage: 'Prescription storage is unavailable.' });
    }

    let parsed = {
        patientFirstName: '',
        patientLastName: '',
        participantDob: '',
        doctorPrintedName: '',
        doctorOfficeName: '',
        doctorOfficeAddress: '',
    };
    if (isPdf) {
        try {
            parsed = await extractPrescriptionFields(file.data);
        } catch (error) {
            console.error('Prescription PDF parsing failed', error);
            throw createError({ statusCode: 400, statusMessage: 'The PDF fields could not be read. Please enter the fields manually.' });
        }
    }

    let attachment;
    try {
        attachment = await storeTemporaryPrescriptionAttachment(environment.PRESCRIPTIONS, environment.ENV, file);
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
    const missing = [
        ['Patient first name', parsed.patientFirstName],
        ['Patient last name', parsed.patientLastName],
        ['Date of birth', parsed.participantDob],
        ['Doctor printed name', parsed.doctorPrintedName],
        ['Doctor office name', parsed.doctorOfficeName],
        ['Doctor office address', parsed.doctorOfficeAddress],
    ]
        .filter(([, value]) => !value)
        .map(([label]) => label);

    return {
        status: 'needs_review' as const,
        message: isPdf
            ? 'PDF uploaded and fields populated. Review the form before submitting.'
            : 'Photo uploaded. Photos are accepted for reference but must be entered manually.',
        storageKey: attachment.key,
        extracted: {
            ...parsed,
            formulaName: '',
            formulaForm: undefined as ProductForm | undefined,
            ouncesPrescribed: undefined as number | undefined,
            durationMonths: undefined as number | undefined,
            doctorSignature: '',
            doctorOfficePhone: '',
            prescriptionSignedDate: '',
        },
        missing,
    };
});
