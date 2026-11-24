import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const provider = readFileSync(new URL('../app/features/requests/components/RequestProviderFields.vue', import.meta.url), 'utf8');
const participant = readFileSync(new URL('../app/features/requests/components/RequestParticipantFields.vue', import.meta.url), 'utf8');
const payload = readFileSync(new URL('../app/features/requests/requestSubmissionBody.ts', import.meta.url), 'utf8');
const formModel = readFileSync(new URL('../app/features/requests/requestForm.ts', import.meta.url), 'utf8');
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
        const sections = ['Medical Documentation *', '<RequestParticipantFields', 'Medical Formula/Nutritionals and Qualifying Diagnosis', '<RequestFoodRestrictionFields', '<RequestProviderFields', '<h2>Surplus Formula</h2>', '<h2>Shipping</h2>', '<h2>Additional Information</h2>'];
        const positions = sections.map(marker => requestForm.indexOf(marker));
        expect(positions.every(position => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        const providerFields = ['doctor-name', 'doctor-signed-off', 'prescription-signed-date', 'doctor-office', 'doctor-address', 'doctor-phone'];
        const providerPositions = providerFields.map((id) => provider.indexOf(`id="${id}"`));
        expect(providerPositions.every(position => position >= 0)).toBe(true);
        expect(providerPositions).toEqual([...providerPositions].sort((a, b) => a - b));
        expect(requestForm.indexOf('<RequestParticipantFields')).toBeLessThan(requestForm.indexOf('id="formula"'));
        expect(requestForm.indexOf('id="diagnosis"')).toBeLessThan(requestForm.indexOf('<RequestProviderFields'));
    });

    it('renders and submits provider details with a signature checkbox', () => {
        expect(payload).toContain('doctorPrintedName:');
        expect(payload).toContain('doctorOfficeName:');
        expect(payload).toContain('doctorOfficeAddress:');
        expect(requestForm).toContain('doctorOfficePhone:');
        expect(payload).toContain('prescriptionSignedDate:');
        expect(provider).toContain('v-model="form.prescriptionSignedDate"');
        expect(provider).toContain('v-model="form.doctorPrintedName"');
        expect(provider).toContain('v-model="form.doctorOfficeName"');
        expect(provider).toContain('v-model="form.doctorOfficeAddress"');
        expect(provider).toContain('v-model="form.doctorOfficePhone"');
        expect(provider).toContain('@input="formatDoctorPhone"');
        expect(provider).toContain('pattern="\\(\\d{3}\\) \\d{3}-\\d{4}"');
        expect(payload).toContain('doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone)');
        expect(provider).toContain("requiredLabel('Provider Name')");
        expect(provider).toContain("requiredLabel('Medical Office/Clinic Name and Address')");
        expect(provider).toContain('aria-label="Medical office/clinic address"');
        expect(provider).toContain("requiredLabel('Phone Number')");
        expect(provider).toContain("requiredLabel('Provider Signature')");
        const signatureInput = provider.match(/<input\s+id="doctor-signed-off"[\s\S]*?\/>/)?.[0];
        expect(signatureInput).toContain('aria-required="true"');
        expect(signatureInput).toMatch(/\srequired(?:\s|=)/);
        expect(signatureInput).not.toContain('title=');
        expect(formModel).toContain('doctorHasSignedOff: false');
        expect(provider).toContain('v-model="form.doctorHasSignedOff"');
        expect(payload).toContain('doctorHasSignedOff: form.doctorHasSignedOff');
        expect(provider).toContain('class="checkbox-control"');
        expect(provider).toContain('id="doctor-signed-off"');
        expect(provider.indexOf('id="doctor-signed-off"')).toBeLessThan(provider.indexOf('id="prescription-signed-date"'));
        expect(provider).toContain('checkbox-confirmation');
        expect(payload).toContain('doctorPrintedName: form.doctorPrintedName');
        expect(payload).toContain('doctorOfficeName: form.doctorOfficeName');
        expect(payload).toContain('doctorOfficeAddress: form.doctorOfficeAddress');
        expect(payload).toContain('doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone)');
        expect(requestForm).not.toContain('doctorSignature:');
        expect(requestForm).not.toContain('v-model="form.doctorSignature"');
    });

    it('shows only available surplus in the section heading', () => {
        expect(requestForm).toContain("useFetch('/api/surplus'");
        expect(requestForm).toContain('lot.agencyId===requestAgencyId.value');
        expect(requestForm).toContain('On Hand: {{ available }} {{ unitLabel(available) }}');
        expect(requestForm).toContain('canIncludeUnspecifiedPackage');
        expect(requestForm).toContain('surplusInventoryDialog.value?.showModal()');
        expect(requestForm).toContain('Recorded Surplus Inventory');
        expect(requestForm).toContain('refreshVisibleSurplusInventory');
        expect(requestForm).toContain('agencyAvailableSurplus(entry)');
        expect(requestForm).not.toContain('On Hand at requesting agency:');
    });
});
