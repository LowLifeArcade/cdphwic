import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
    extractPrescriptionFields,
    configurePrescriptionPdfJs,
    mapPrescriptionFields,
    normalizePrescriptionDate,
} from '../server/utils/prescriptionParser';

describe('CDPH prescription field parser', () => {
    it('maps CDPH AcroForm field names into request fields', () => {
        const result = mapPrescriptionFields({
            'Patient First Name': [{ value: '  Ana ' }],
            'Patient Last Name': [{ value: ' Lopez ' }],
            'Date of birth': [{ value: '02/14/2024' }],
            'Provider Name': [{ value: 'Dr. Rivera' }],
            'Medical Office or Clinic Name and Address': [{ value: 'Sunrise Clinic\n123 Main St\nSacramento, CA 95814' }],
            'medi-cal': [{ value: 'On' }],
            private: [{ value: 'Off' }],
            'Ready to Feed': [{ value: 'Ready to Feed' }],
            'rtf justification': [{ value: 'Only available form' }],
            Amount: [{ value: '24' }],
            '3 months': [{ value: '3 months' }],
            'Food allergy': [{ value: 'On' }],
            'specify allergy': [{ value: 'Peanut allergy' }],
            'Provider phone': [{ value: '916-555-0123' }],
            'Signature date': [{ value: 'Aug 1st 2026' }],
            Comments: [{ value: 'Needs follow-up.' }],
        });

        expect(result).toEqual({
            patientFirstName: 'Ana',
            patientLastName: 'Lopez',
            participantDob: '2024-02-14',
            doctorPrintedName: 'Dr. Rivera',
            doctorOfficeName: 'Sunrise Clinic',
            doctorOfficeAddress: '123 Main St\nSacramento, CA 95814',
            medicalStatus: 'yes',
            productForm: 'ready-to-feed',
            readyToFeedJustification: 'Only available form',
            ouncesPrescribed: 24,
            durationMonths: 3,
            diagnosis: 'Food allergy: Peanut allergy',
            doctorOfficePhone: '916-555-0123',
            prescriptionSignedDate: '2026-08-01',
            additionalNotes: 'Needs follow-up.',
        });
    });

    it('reads values saved on a parent or default field entry', () => {
        expect(mapPrescriptionFields({
            'Patient First Name': [{ defaultValue: 'Jamie' }],
            'Patient Last Name': [{ value: 'Example' }],
            'Date of birth': [{ defaultValue: '4/15/2020' }],
            'Provider Name': [{ value: 'Dr. Taylor Morgan' }],
            'Medical Office or Clinic Name and Address': [{ defaultValue: 'Example Pediatrics\n123 Test Avenue' }],
        })).toMatchObject({
            patientFirstName: 'Jamie',
            participantDob: '2020-04-15',
            doctorOfficeName: 'Example Pediatrics',
        });
    });

    it('configures PDF.js to use its in-process worker in the Worker runtime', () => {
        const runtime = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
        delete runtime.pdfjsWorker;

        configurePrescriptionPdfJs();

        expect(runtime.pdfjsWorker).toBeDefined();
    });

    it('normalizes supported date formats and leaves unknown values blank', () => {
        expect(normalizePrescriptionDate('2024-02-14')).toBe('2024-02-14');
        expect(normalizePrescriptionDate('2/14/2024')).toBe('2024-02-14');
        expect(normalizePrescriptionDate('Aug 1st 2026')).toBe('2026-08-01');
        expect(normalizePrescriptionDate('July 1 26')).toBe('2026-07-01');
        expect(normalizePrescriptionDate('August 1, 2026')).toBe('2026-08-01');
        expect(normalizePrescriptionDate('08012026')).toBe('2026-08-01');
        expect(normalizePrescriptionDate('07-01-26')).toBe('2026-07-01');
        expect(normalizePrescriptionDate('not a date')).toBe('');
    });

    it('extracts fields from a filled CDPH 247 PDF fixture', async () => {
        const pdf = await readFile(new URL('./fixtures/cdph247-filled.pdf', import.meta.url));
        const data = new Uint8Array(pdf);
        await expect(extractPrescriptionFields(data)).resolves.toMatchObject({
            patientFirstName: 'Jamie',
            patientLastName: 'Example',
            participantDob: '2020-04-15',
            doctorPrintedName: 'Dr. Taylor Morgan',
            doctorOfficeName: 'Example Pediatrics',
            doctorOfficeAddress: '123 Test Avenue\nSacramento, CA 95814',
            medicalStatus: 'yes',
            productForm: 'ready-to-feed',
            readyToFeedJustification: 'Only available form',
            ouncesPrescribed: 24,
            durationMonths: 3,
            diagnosis: 'Food allergy: Peanut allergy',
            doctorOfficePhone: '916-555-0123',
            prescriptionSignedDate: '2026-08-01',
            additionalNotes: 'Needs follow-up.',
        });
        expect(data.byteLength).toBeGreaterThan(0);
    });
});
