import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface ParsedPrescriptionFields {
    patientFirstName: string;
    patientLastName: string;
    participantDob: string;
    doctorPrintedName: string;
    doctorOfficeName: string;
    doctorOfficeAddress: string;
}

type AcroFormField = { value?: string; defaultValue?: string };

function fieldValue(fields: Record<string, AcroFormField[]>, name: string) {
    const field = fields[name]?.find((entry) => {
        const value = typeof entry.value === 'string' ? entry.value : entry.defaultValue;
        return typeof value === 'string' && value.trim();
    });
    const value = field?.value ?? field?.defaultValue;
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizePrescriptionDate(value: string) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
    if (!match) {
        return '';
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return '';
    }
    return date.toISOString().slice(0, 10);
}

export function mapPrescriptionFields(fields: Record<string, AcroFormField[]>): ParsedPrescriptionFields {
    const office = fieldValue(fields, 'Medical Office or Clinic Name and Address');
    const officeLines = office.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return {
        patientFirstName: fieldValue(fields, 'Patient First Name'),
        patientLastName: fieldValue(fields, 'Patient Last Name'),
        participantDob: normalizePrescriptionDate(fieldValue(fields, 'Date of birth')),
        doctorPrintedName: fieldValue(fields, 'Provider Name'),
        doctorOfficeName: officeLines[0] ?? '',
        doctorOfficeAddress: officeLines.slice(1).join('\n') || office,
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
