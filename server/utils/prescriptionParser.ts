import { blankFormula, type FormulaEntry } from '../../shared/formulaEntries';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { formulaCatalog, defaultFormulaForm, availableFormulaForms } from '../../shared/formulaCatalog';
import type { ProductForm } from '../../shared/domain';
import { normalizePhoneNumber } from '../../shared/phone';

export interface ParsedPrescriptionFields {
    formulas: FormulaEntry[];
    formulaName: string;
    wicFoodRestrictions: '' | 'none' | 'restricted' | 'not-indicated';
    wicFoodRestrictionDetails: string;
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
    let officeLines = office.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (officeLines.length === 1) {
        const split = /^(.*?)(?:,\s*|\s+)(?=\d{1,6}\s+\S)/.exec(office);
        if (split) {
            const addressParts = office.slice(split[0].length).split(/,\s*/);
            officeLines = [split[1]!, addressParts.length > 1 ? `${addressParts[0]}\n${addressParts.slice(1).join(', ')}` : addressParts[0]!];
        }
    }
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
        .join('\n');
    const checkedForms = [
        ['Powder', 'powder'],
        ['Concentrate', 'concentrate'],
        ['Ready to Feed', 'ready-to-feed'],
    ].filter(([field]) => isChecked(fields, field));
    const productForm = checkedForms.length === 1 ? checkedForms[0]![1] as ProductForm : undefined;
    const durationMonths = [1, 2, 3, 4, 5, 6].find((months) => isChecked(fields, `${months} month${months === 1 ? '' : 's'}`));
    const noRestrictions = isChecked(fields, 'No food restrictions');
    const restricted = isChecked(fields, 'Food restrictions');
    const restrictionFields = [
        'No infant cereal', 'No infant fruits/vegetables', 'No infant foods increased formula',
        'No infant fruits/vegetables fresh frozen canned', 'No milk', 'No cheese', 'No eggs',
        'No yogurt', 'No plant-based milk alternatives', 'No tofu', 'No peanut butter', 'No beans',
        'No cereal', 'No fruits/vegetables', 'No juice', 'No foods formula only',
        'Needs canned fish light tuna salmon sardines', 'Needs purees provide infant fruits vegetables',
    ];
    const restrictionDetails = restrictionFields.filter((name) => isChecked(fields, name));
    if (isChecked(fields, 'No whole grains Specify types')) {
        const types = fieldValue(fields, 'specify whole grains');
        restrictionDetails.push(types ? `No whole grains: ${types}` : 'No whole grains');
    }
    if (isChecked(fields, 'If premature Provide infant foods after')) {
        restrictionDetails.push(`Provide infant foods after: ${fieldValue(fields, 'premature months')} months`);
    }
    const formulaNames = formulaCatalog.filter((formula) => isChecked(fields, formula.pdfField)).map((formula) => formula.name);
    const writtenFormula = fieldValue(fields, 'formula/medical food');
    for (const text of writtenFormula.split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean)) {
        let remaining = text.toLowerCase();
        const recognized: Array<{ name: string; position: number }> = [];
        for (const formula of [...formulaCatalog].sort((a, b) => b.name.length - a.name.length)) {
            const position = remaining.indexOf(formula.name.toLowerCase());
            if (position >= 0) {
                recognized.push({ name: formula.name, position });
                remaining = remaining.slice(0, position) + ' '.repeat(formula.name.length) + remaining.slice(position + formula.name.length);
            }
        }
        const names = recognized.length ? recognized.sort((a, b) => a.position - b.position).map((item) => item.name) : [text];
        for (const name of names) if (!formulaNames.some((item) => item.toLowerCase() === name.toLowerCase())) formulaNames.push(name);
    }
    const formulas: FormulaEntry[] = formulaNames.map((name, index) => {
        const listed = formulaCatalog.find((item) => item.name.toLowerCase() === name.toLowerCase());
        const choice = listed?.name ?? 'Other';
        return {
            ...blankFormula(), formulaName: choice, otherFormulaName: listed ? '' : name,
            productForm: productForm && availableFormulaForms(choice).includes(productForm) ? productForm : defaultFormulaForm(choice),
            ouncesPrescribed: index === 0 ? numericFieldValue(fields, 'Amount') ?? '' : '',
            readyToFeedJustification: index === 0 ? fieldValue(fields, 'rtf justification') : '',
        };
    });
    return {
        formulas,
        formulaName: formulas[0]?.formulaName ?? '',
        wicFoodRestrictions: noRestrictions && restricted ? '' : noRestrictions ? 'none' : restricted ? 'restricted' : 'not-indicated',
        wicFoodRestrictionDetails: restricted ? restrictionDetails.join('; ') : '',
        patientFirstName: fieldValue(fields, 'Patient First Name'),
        patientLastName: fieldValue(fields, 'Patient Last Name'),
        participantDob: normalizePrescriptionDate(fieldValue(fields, 'Date of birth')),
        doctorPrintedName: fieldValue(fields, 'Provider Name'),
        doctorOfficeName: officeLines[0] ?? '',
        doctorOfficeAddress: officeLines.slice(1).join('\n'),
        medicalStatus: isChecked(fields, 'medi-cal') ? 'yes' : isChecked(fields, 'private') ? 'no' : 'pending',
        ...(productForm ? { productForm } : {}),
        readyToFeedJustification: fieldValue(fields, 'rtf justification'),
        ...(numericFieldValue(fields, 'Amount') ? { ouncesPrescribed: numericFieldValue(fields, 'Amount') } : {}),
        ...(durationMonths ? { durationMonths } : {}),
        diagnosis,
        doctorOfficePhone: normalizePhoneNumber(fieldValue(fields, 'Provider phone')),
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
