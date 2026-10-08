import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requestForm = readFileSync(new URL('../app/pages/requests/new.vue', import.meta.url), 'utf8');

describe('new request doctor fields', () => {
    it('links to the required CDPH prescription document near the required-fields note', () => {
        expect(requestForm).toContain('https://www.cdph.ca.gov/CDPH%20Document%20Library/ControlledForms/cdph247.pdf');
        expect(requestForm).toContain('target="_blank"');
        expect(requestForm).toContain('rel="noopener noreferrer"');
        expect(requestForm).toContain('Fields marked with * are required.');
    });

    it('renders and submits doctor details without a signature field', () => {
        expect(requestForm).toContain('doctorPrintedName:');
        expect(requestForm).toContain('doctorOfficeName:');
        expect(requestForm).toContain('doctorOfficeAddress:');
        expect(requestForm).toContain('doctorOfficePhone:');
        expect(requestForm).toContain('v-model="form.doctorPrintedName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeAddress"');
        expect(requestForm).toContain('v-model="form.doctorOfficePhone"');
        expect(requestForm).toContain("requiredLabel('Doctor printed name')");
        expect(requestForm).toContain("requiredLabel('Doctor office name')");
        expect(requestForm).toContain("requiredLabel('Doctor office address')");
        expect(requestForm).toContain("requiredLabel('Doctor office phone')");
        expect(requestForm).toContain("requiredLabel('Doctor has signed off')");
        expect(requestForm.match(/id="doctor-(?:name|office|address|phone|signed-off)"[\s\S]*?required/g)?.length).toBe(5);
        expect(requestForm).toContain('doctorHasSignedOff: false');
        expect(requestForm).toContain('v-model="form.doctorHasSignedOff"');
        expect(requestForm).toContain('doctorHasSignedOff: form.doctorHasSignedOff');
        expect(requestForm).toContain('class="checkbox-control"');
        expect(requestForm).toContain('id="doctor-signed-off"');
        expect(requestForm.indexOf('id="doctor-signed-off"')).toBeGreaterThan(requestForm.indexOf('id="doctor-phone"'));
        expect(requestForm).toContain('checkbox-confirmation');
        expect(requestForm).toContain('doctorPrintedName: form.doctorPrintedName');
        expect(requestForm).toContain('doctorOfficeName: form.doctorOfficeName');
        expect(requestForm).toContain('doctorOfficeAddress: form.doctorOfficeAddress');
        expect(requestForm).toContain('doctorOfficePhone: form.doctorOfficePhone');
        expect(requestForm).not.toContain('doctorSignature:');
        expect(requestForm).not.toContain('v-model="form.doctorSignature"');
    });
});
