import { describe, expect, it } from 'vitest';
import {
    MAX_PRESCRIPTION_BYTES,
    getPrescriptionContentType,
    hasValidPrescriptionSignature,
    makePrescriptionStorageKey,
} from '../server/utils/prescriptionStorage';

describe('prescription storage policy', () => {
    it('accepts only PDFs and supported photos', () => {
        expect(getPrescriptionContentType('application/pdf', 'prescription.pdf')).toBe('application/pdf');
        expect(getPrescriptionContentType('image/jpeg', 'prescription.jpg')).toBe('image/jpeg');
        expect(getPrescriptionContentType('', 'prescription.webp')).toBe('image/webp');
        expect(getPrescriptionContentType('text/plain', 'prescription.txt')).toBeUndefined();
    });

    it('rejects files whose bytes do not match the declared type', () => {
        expect(hasValidPrescriptionSignature(new TextEncoder().encode('%PDF-1.7'), 'application/pdf')).toBe(true);
        expect(hasValidPrescriptionSignature(new TextEncoder().encode('not a pdf'), 'application/pdf')).toBe(false);
        expect(hasValidPrescriptionSignature(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')).toBe(true);
    });

    it('caps files and creates isolated safe object keys', () => {
        expect(MAX_PRESCRIPTION_BYTES).toBe(10 * 1024 * 1024);
        const key = makePrescriptionStorageKey('dev', 42, 'my prescription?.pdf', 'upload-123');
        expect(key).toBe('dev/requests/42/upload-123-my-prescription-.pdf');
        expect(key).not.toContain('..');
        expect(key).not.toContain(' ');
    });
});
