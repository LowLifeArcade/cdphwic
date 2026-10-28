import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const list = readFileSync(new URL('../app/components/RequestList.vue', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('../app/components/RequestDetailDrawer.vue', import.meta.url), 'utf8');

describe('request operations UI', () => {
    it('shows request type and submitted date while keeping identifiers in the drawer', () => {
        expect(list).toContain('request.requestKind');
        expect(list).toContain('Submitted {{ formatDate(request.submissionDate) }}');
        expect(list).not.toContain('Rep #{{ request.agencyMemberId }}');
        expect(list).not.toContain('<strong>#{{ request.id }}</strong>');
        expect(drawer).toContain('Request #{{ request.id }}');
        expect(drawer).toContain('request.requestKind');
    });

    it('supports staff editing, monthly allocations, and denial-only reasons', () => {
        expect(drawer).toContain('v-model.number="draft.ouncesPrescribed"');
        expect(drawer).toContain('v-model="issuance.month"');
        expect(drawer).toContain('Add issuance month');
        expect(drawer).toContain('v-if="draft.status === \'denied\'"');
        expect(drawer).toContain('authorization-form.pdf');
        expect(drawer).toContain('request.shipping.addressLine1');
        expect(drawer).toContain('rep?.email');
    });

    it('keeps request-form fields read-only until section editing and isolates issuance months to staff processing', () => {
        expect(drawer).toContain('>Edit</button>');
        expect(drawer).not.toContain('>Edit fields</button>');
        expect(drawer).toContain('<span>Medical Office/Clinic</span>');
        expect(drawer).toContain('Prescription');
        expect(drawer).toContain('+ Add issuance month');
        expect(drawer).not.toContain('+ Add benefit month');
        expect(drawer).toContain('month-select');
    });

    it('opens uploaded documentation beside the request and uses the requested section order', () => {
        expect(drawer).toContain('attachment-toggle');
        expect(drawer).toContain('RequestDocumentPreview');
        expect(drawer).toContain('request-document-pane');
        expect(drawer).not.toContain('Submitted prescription form');
        expect(drawer).not.toContain('<h3>Local Agency</h3>');
        const preview=readFileSync(new URL('../app/components/RequestDocumentPreview.vue', import.meta.url),'utf8');
        expect(preview).toMatch(/'x-demo-user':\s*identity.value/);
        expect(preview).toContain('URL.revokeObjectURL');
        expect(drawer.indexOf('<h3>Participant</h3>')).toBeLessThan(drawer.indexOf('<h3>Prescription</h3>'));
        expect(drawer.indexOf('<h3>Prescription</h3>')).toBeLessThan(drawer.indexOf('<h3>WIC Food Restrictions</h3>'));
        expect(drawer.indexOf('<h3>WIC Food Restrictions</h3>')).toBeLessThan(drawer.indexOf('<h3>Health Care Provider</h3>'));
        expect(drawer.indexOf('rep?.email')).toBeGreaterThan(drawer.indexOf('<h3>Shipping Info</h3>'));
    });

    it('keeps CDPH decisions and shipment together', () => {
        expect(drawer).not.toContain('Staff-only fields');
        expect(drawer).toContain('Are you sure you want to deny this request?');
        expect(drawer).toContain('v-if="pendingDecision"');
        expect(drawer).toContain('Confirm denial');
        expect(drawer).not.toContain('window.confirm');
        expect(drawer).toContain('decision-selected');
        expect(drawer).toContain('Undo approval or denial');
        expect(drawer).toContain('previousDecision');
        expect(drawer).toContain('approved: false');
        expect(drawer).toContain('approved: true');
        expect(drawer).toContain('status: getApprovalStatus(draft.status ?? props.request!.status)');
        expect(drawer).toContain("status: draft.status === 'denied' ? 'opened' : draft.status");
        expect(drawer).toContain('const restoredDecision = previousDecision.value ??');
        expect(drawer).toContain('v-else class="decision-buttons"');
        expect(drawer).toContain('Next Steps');
        expect(drawer).toContain('class="cdph-fields" :disabled="draft.status === \'denied\'"');
        expect(drawer.indexOf('CDPH/WIC Use Only')).toBeLessThan(drawer.indexOf('<h3>Shipping Info</h3>'));
    });

    it('shows product metadata and combined approval quantities in CDPH processing', () => {
        expect(drawer).toContain('Formula Requested');
        expect(drawer).toContain('Product Number');
        expect(drawer).toContain('Units Per Case');
        expect(drawer).toContain('Yield');
        expect(drawer).toContain('Agency Units On Hand');
        expect(drawer).toContain('cases for');
        expect(drawer).not.toContain('Amount Approved');
        expect(drawer).toContain('Expected Surplus Unit');
        expect(drawer).toContain('Agency Units On Hand Unit');
        expect(drawer).toContain('Agency Units On Hand');
        expect(drawer).not.toContain('Cases Ordered');
        expect(drawer).toContain('>Issuance</h4>');
        expect(drawer.indexOf('Issuance')).toBeLessThan(drawer.indexOf('Approved Cases for Approved Months'));
        expect(drawer.indexOf('Issuance')).toBeLessThan(drawer.indexOf('Next Steps'));
    });
});
