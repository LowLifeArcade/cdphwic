import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requestForm = readFileSync(new URL('../app/pages/requests/new.vue', import.meta.url), 'utf8');

describe('new request doctor fields', () => {
    it('does not present uploads as AI review and explains image manual entry', () => {
        expect(requestForm).not.toContain('AI review');
        expect(requestForm).not.toContain('AI extraction');
        expect(requestForm).toContain('Choose a PDF or image.<br />PDFs populate matching form fields; images require manual entry.');
        expect(requestForm).toContain('@change="handleFileSelection"');
        expect(requestForm).toContain(':aria-invalid="validationAttempted && !hasRequiredDocumentation"');
        expect(requestForm).toContain('@drop.prevent="handleDrop"');
        expect(requestForm).toContain('v-if="!selectedPrescription"');
        expect(requestForm).toMatch(/class="upload-drop"[\s\S]*v-if="!selectedPrescription"/);
        expect(requestForm).toContain('Processing {{ selectedPrescription.name }}');
        expect(requestForm).toContain('class="uploaded-file"');
        expect(requestForm).toContain('Remove uploaded prescription');
        expect(requestForm).toContain('class="confirmation-modal"');
        expect(requestForm).toContain('Remove file');
        expect(requestForm).not.toContain('window.confirm');
    });

    it('shows medical documentation requirements without the CDPH download link', () => {
        expect(requestForm).toContain('<h2>Medical Documentation *</h2>');
        expect(requestForm).not.toContain('cdph247.pdf');
        expect(requestForm).not.toContain('Download the CDPH prescription form here.');
        expect(requestForm).not.toContain('(usually 1–6)');
        expect(requestForm).toContain('Provider printed name, signature, and date signed');
        expect(requestForm).toContain('Provider office name, address, and phone number');
        expect(requestForm).not.toContain('<li>Date signed</li>');
        expect(requestForm).toContain('<strong>Drag and drop medical documentation here</strong>');
        expect(requestForm).not.toContain('Fields marked with * are required.');
    });

    it('orders participant, formula, provider, and additional information sections', () => {
        const headings = [...requestForm.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]!.includes("requiredLabel('WIC Food Restrictions')") ? 'WIC Food Restrictions' : match[1]);
        expect(headings).toEqual([
            'Medical Documentation *',
            'Participant',
            'Medical Formula/Nutritionals and Qualifying Diagnosis',
            'WIC Food Restrictions',
            'Health Care Provider',
            'Surplus Formula',
            'Shipping',
            'Additional Information',
        ]);
        const providerFields = ['doctor-name', 'doctor-signed-off', 'prescription-signed-date', 'doctor-office', 'doctor-address', 'doctor-phone'];
        const positions = providerFields.map((id) => requestForm.indexOf(`id="${id}"`));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(requestForm.indexOf('id="medical"')).toBeLessThan(requestForm.indexOf('id="formula"'));
        expect(requestForm.indexOf('id="diagnosis"')).toBeLessThan(requestForm.indexOf('id="doctor-name"'));
    });

    it('renders and submits provider details with a signature checkbox', () => {
        expect(requestForm).toContain('doctorPrintedName:');
        expect(requestForm).toContain('doctorOfficeName:');
        expect(requestForm).toContain('doctorOfficeAddress:');
        expect(requestForm).toContain('doctorOfficePhone:');
        expect(requestForm).toContain('prescriptionSignedDate:');
        expect(requestForm).toContain('v-model="form.prescriptionSignedDate"');
        expect(requestForm).toContain('v-model="form.doctorPrintedName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeName"');
        expect(requestForm).toContain('v-model="form.doctorOfficeAddress"');
        expect(requestForm).toContain('v-model="form.doctorOfficePhone"');
        expect(requestForm).toContain('@input="formatDoctorPhone"');
        expect(requestForm).toContain('pattern="\\(\\d{3}\\) \\d{3}-\\d{4}"');
        expect(requestForm).toContain('doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone)');
        expect(requestForm).toContain("requiredLabel('Provider Name')");
        expect(requestForm).toContain("requiredLabel('Medical Office/Clinic Name and Address')");
        expect(requestForm).toContain('aria-label="Medical office/clinic address"');
        expect(requestForm).toContain("requiredLabel('Phone Number')");
        expect(requestForm).toContain("requiredLabel('Provider Signature')");
        const signatureInput = requestForm.match(/<input\s+id="doctor-signed-off"[\s\S]*?\/>/)?.[0];
        expect(signatureInput).toContain('aria-required="true"');
        expect(signatureInput).toMatch(/\srequired(?:\s|=)/);
        expect(signatureInput).not.toContain('title=');
        expect(requestForm).toContain('doctorHasSignedOff: false');
        expect(requestForm).toContain('v-model="form.doctorHasSignedOff"');
        expect(requestForm).toContain('doctorHasSignedOff: form.doctorHasSignedOff');
        expect(requestForm).toContain('class="checkbox-control"');
        expect(requestForm).toContain('id="doctor-signed-off"');
        expect(requestForm.indexOf('id="doctor-signed-off"')).toBeLessThan(requestForm.indexOf('id="prescription-signed-date"'));
        expect(requestForm).toContain('checkbox-confirmation');
        expect(requestForm).toContain('doctorPrintedName: form.doctorPrintedName');
        expect(requestForm).toContain('doctorOfficeName: form.doctorOfficeName');
        expect(requestForm).toContain('doctorOfficeAddress: form.doctorOfficeAddress');
        expect(requestForm).toContain('doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone)');
        expect(requestForm).not.toContain('doctorSignature:');
        expect(requestForm).not.toContain('v-model="form.doctorSignature"');
    });
});
