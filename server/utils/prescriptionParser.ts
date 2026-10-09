import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import type { ProductForm } from '../../shared/domain';

export interface ParsedPrescriptionFields {
    patientFirstName: string;
    patientLastName: string;
    participantDob: string;
    doctorPrintedName: string;
    doctorOfficeName: string;
    doctorOfficeAddress: string;
    medicalStatus: 'yes' | 'no' | 'pending';
    productForm?: ProductForm;
    readyToFeedJustification: string;
    ouncesPrescribed?: number;
    durationMonths?: number;
    diagnosis: string;
    doctorOfficePhone: string;
    prescriptionSignedDate: string;
    additionalNotes: string;
}

type AcroFormField = { value?: string; defaultValue?: string };

const MONTHS = new Map([
    ['jan', 1],
    ['january', 1],
    ['feb', 2],
    ['february', 2],
    ['mar', 3],
    ['march', 3],
    ['apr', 4],
    ['april', 4],
    ['may', 5],
    ['jun', 6],
    ['june', 6],
    ['jul', 7],
    ['july', 7],
    ['aug', 8],
    ['august', 8],
    ['sep', 9],
    ['sept', 9],
    ['september', 9],
    ['oct', 10],
    ['october', 10],
    ['nov', 11],
    ['november', 11],
    ['dec', 12],
    ['december', 12],
]);

function fieldValue(fields: Record<string, AcroFormField[]>, name: string) {
    const field = fields[name]?.find((entry) => {
        const value = typeof entry.value === 'string' ? entry.value : entry.defaultValue;
        return typeof value === 'string' && value.trim();
    });
    const value = field?.value ?? field?.defaultValue;
    return typeof value === 'string' ? value.trim() : '';
}

function isChecked(fields: Record<string, AcroFormField[]>, name: string) {
    const value = fieldValue(fields, name).toLowerCase();
    return Boolean(value) && !['off', 'false', 'no', '0'].includes(value);
}

function numericFieldValue(fields: Record<string, AcroFormField[]>, name: string) {
    const value = Number(fieldValue(fields, name).replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function normalizePrescriptionDate(value: string) {
    const trimmed = value
        .trim()
        .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
        .replace(/[.'’]/g, '')
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    let month: number;
    let day: number;
    let yearText: string;

    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    if (match) {
        yearText = match[1];
        month = Number(match[2]);
        day = Number(match[3]);
    } else {
        match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
        if (match) {
            month = Number(match[1]);
            day = Number(match[2]);
            yearText = match[3];
        } else {
            match = /^(\d{1,2})(?:\s+)([a-z]+)\s+(\d{2,4})$/i.exec(trimmed)
                ?? /^([a-z]+)\s+(\d{1,2})\s+(\d{2,4})$/i.exec(trimmed);
            if (match) {
                const firstIsMonth = Boolean(MONTHS.get(match[1].toLowerCase()));
                month = firstIsMonth ? MONTHS.get(match[1].toLowerCase())! : MONTHS.get(match[2].toLowerCase())!;
                day = Number(firstIsMonth ? match[2] : match[1]);
                yearText = match[3];
            } else {
                match = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(trimmed);
                if (!match) {
                    return '';
                }
                month = Number(match[1]);
                day = Number(match[2]);
                yearText = match[3];
            }
        }
    }

    const numericYear = Number(yearText);
    const year = yearText.length === 2 ? (numericYear < 30 ? 2000 + numericYear : 1900 + numericYear) : numericYear;
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
        return '';
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return '';
    }
    return date.toISOString().slice(0, 10);
}

export function mapPrescriptionFields(fields: Record<string, AcroFormField[]>): ParsedPrescriptionFields {
    const office = fieldValue(fields, 'Medical Office or Clinic Name and Address');
    const officeLines = office.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const diagnosisFields: Array<[string, string, string]> = [
        ['Prematurity', 'adjusted age months', 'Prematurity'],
        ['Failure to thrive', '', 'Failure to thrive'],
        ['Low birthweight', '', 'Low birthweight'],
        ['Dysphagia', '', 'Dysphagia'],
        ['Food allergy', 'specify allergy', 'Food allergy'],
        ['Immune system disorder', 'specify immune disorder', 'Immune system disorder'],
        ['Gastrointestinal disorder', 'specify gastrointestinal disorder', 'Gastrointestinal disorder'],
        ['Lifethreatening disorder', 'specify disorder', 'Life-threatening disorder'],
        ['GeneticMetabolic disorder', 'specify  Genetic/Metabolic disorder', 'Genetic/metabolic disorder'],
        ['Malabsorption', 'malabsorption nutrient', 'Malabsorption'],
        ['Other medical conditions', 'specify condition(s)', 'Other medical condition'],
    ];
    const diagnosis = diagnosisFields
        .filter(([checkbox]) => isChecked(fields, checkbox))
        .map(([, detailField, label]) => {
            const detail = detailField ? fieldValue(fields, detailField) : '';
            return detail ? `${label}: ${detail}` : label;
        })
        .join('; ');
    const productForm = [
        ['Powder', 'powder'],
        ['Concentrate', 'concentrate'],
        ['Ready to Feed', 'ready-to-feed'],
    ].find(([field]) => isChecked(fields, field))?.[1] as ProductForm | undefined;
    const durationMonths = [1, 2, 3, 4, 5, 6].find((months) => isChecked(fields, `${months} month${months === 1 ? '' : 's'}`));
    return {
        patientFirstName: fieldValue(fields, 'Patient First Name'),
        patientLastName: fieldValue(fields, 'Patient Last Name'),
        participantDob: normalizePrescriptionDate(fieldValue(fields, 'Date of birth')),
        doctorPrintedName: fieldValue(fields, 'Provider Name'),
        doctorOfficeName: officeLines[0] ?? '',
        doctorOfficeAddress: officeLines.slice(1).join('\n') || office,
        medicalStatus: isChecked(fields, 'medi-cal') ? 'yes' : isChecked(fields, 'private') ? 'no' : 'pending',
        ...(productForm ? { productForm } : {}),
        readyToFeedJustification: fieldValue(fields, 'rtf justification'),
        ...(numericFieldValue(fields, 'Amount') ? { ouncesPrescribed: numericFieldValue(fields, 'Amount') } : {}),
        ...(durationMonths ? { durationMonths } : {}),
        diagnosis,
        doctorOfficePhone: fieldValue(fields, 'Provider phone'),
        prescriptionSignedDate: normalizePrescriptionDate(fieldValue(fields, 'Signature date')),
        additionalNotes: fieldValue(fields, 'Comments'),
    };
}

export function configurePrescriptionPdfJs() {
    const runtime = globalThis as typeof globalThis & {
        pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
    };
    runtime.pdfjsWorker ??= { WorkerMessageHandler };
}

export async function extractPrescriptionFields(data: Uint8Array) {
    configurePrescriptionPdfJs();
    // PDF.js transfers the input buffer to its in-process worker. Keep the
    // upload bytes available for validation and R2 storage after parsing.
    const pdfData = new Uint8Array(data);
    const loadingTask = pdfjs.getDocument({ data: pdfData, password: '' });
    const document = await loadingTask.promise;
    try {
        const fields = (await document.getFieldObjects()) as Record<string, AcroFormField[]> | null;
        return mapPrescriptionFields(fields ?? {});
    } finally {
        await document.destroy();
    }
}
