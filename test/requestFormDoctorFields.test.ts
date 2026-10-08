import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requestForm = readFileSync(new URL('../app/pages/requests/new.vue', import.meta.url), 'utf8');

describe('new request doctor fields', () => {
    it('renders and submits doctor details without a signature field', () => {
        expect(requestForm).toContain('doctorPrintedName:');
        expect(requestForm).toContain('doctorOfficeName:');
        expect(requestForm).toContain('doctorOfficeAddress:');
        expect(requestForm).toContain('doctorOfficePhone:');
        expect(requestForm).toContain('v-model="form.doctorPrintedName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeAddress"');
        expect(requestForm).toContain('v-model="form.doctorOfficePhone"');
        expect(requestForm).toContain('doctorPrintedName: form.doctorPrintedName');
        expect(requestForm).toContain('doctorOfficeName: form.doctorOfficeName');
        expect(requestForm).toContain('doctorOfficeAddress: form.doctorOfficeAddress');
        expect(requestForm).toContain('doctorOfficePhone: form.doctorOfficePhone');
        expect(requestForm).not.toContain('doctorSignature:');
        expect(requestForm).not.toContain('v-model="form.doctorSignature"');
    });
});
