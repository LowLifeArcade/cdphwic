import { describe, expect, it } from 'vitest';
import { hasMedicalDocumentation } from '../shared/medicalDocumentation';

describe('required medical documentation', () => {
    it('rejects missing files and removed attachments', () => {
        expect(hasMedicalDocumentation({})).toBe(false);
        expect(hasMedicalDocumentation({ fileSize: 0 })).toBe(false);
        expect(hasMedicalDocumentation({ existingKey: 'saved.pdf', removeExisting: true })).toBe(false);
    });
    it('accepts new uploads, temporary uploads, and retained attachments', () => {
        expect(hasMedicalDocumentation({ fileSize: 12 })).toBe(true);
        expect(hasMedicalDocumentation({ temporaryKey: 'temporary/file.pdf' })).toBe(true);
        expect(hasMedicalDocumentation({ existingKey: 'saved.pdf' })).toBe(true);
        expect(hasMedicalDocumentation({ temporaryKey: 'replacement.pdf', existingKey: 'old.pdf', removeExisting: true })).toBe(true);
    });
});
