import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const list = readFileSync(new URL('../app/components/RequestList.vue', import.meta.url), 'utf8');
const medical = readFileSync(new URL('../app/features/requests/components/RequestMedicalDetails.vue', import.meta.url), 'utf8');
const authorization = readFileSync(new URL('../app/features/requests/components/RequestAuthorizationFields.vue', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('../app/components/RequestDetailDrawer.vue', import.meta.url), 'utf8');

describe('request operations UI', () => {
    it('shows request type and submitted date while keeping identifiers in the drawer', () => {
        expect(list).toContain('request.requestKind');
        expect(list).toContain('Submitted {{ formatDisplayDate(request.submissionDate) }}');
        expect(list).not.toContain('Rep #{{ request.agencyMemberId }}');
        expect(list).not.toContain('<strong>#{{ request.id }}</strong>');
        expect(drawer).toContain('Request #{{ request.id }}');
        expect(drawer).toContain('request.requestKind');
    });

    it('keeps the Special Order product tag but hides the status tag after completion', () => {
        expect(list).toContain('v-if="formula.specialOrder" class="status-badge status-special-order formula-order-tag"');
        expect(list).toContain('v-if="allFormulasSpecialOrder(request) && request.status!==\'complete\'"');
    });

    it('shows Local Agencies the special-order delivery notice when any formula is special order', () => {
        expect(drawer).toContain("identity==='agency' && hasSpecialOrder(request)");
        expect(drawer).toContain('Product will take up to 3+ weeks for delivery.');
    });

    it('lets Local Agencies reply while keeping issue resolution with CDPH/WIC', () => {
        const issuePanel=readFileSync(new URL('../app/components/ShipmentIssuePanel.vue', import.meta.url), 'utf8');
        expect(issuePanel).toContain("identity.value==='admin' || identity.value==='internal'");
        expect(issuePanel).toContain('Mark Issue Resolved');
        expect(issuePanel).toContain("identity.value==='admin' || identity.value==='internal' || identity.value==='agency'");
        expect(issuePanel).toContain('v-if="canRespond && activeShipmentIssue(shipment) && !editing"');
        expect(issuePanel).toContain("response.senderType==='agency'?'Local Agency':'CDPH/WIC'");
        expect(issuePanel).not.toContain('canReport || canResolve');
    });

    it('visually separates request rows with outlined cards and spacing', () => {
        expect(list).toContain('.request-row-shell {position:relative;margin:6px 8px;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface-raised);}');
    });

    it('supports staff editing, monthly allocations, and denial-only reasons', () => {
        expect(medical).toContain('v-model="editableFormulas[index]!"');
        expect(medical).toContain('AdditionalFormulaFields');
        expect(authorization).toContain('v-model="issuance.month"');
        expect(authorization).toContain('Add issuance month');
        expect(drawer).toContain('v-if="request.status===\'denied\'"');
        expect(drawer).toContain('authorization-form.pdf');
        expect(drawer).toContain('shipment-confirmation.pdf');
        expect(drawer).toContain('allShipmentsConfirmed(request)');
        expect(drawer).toContain('request.shipping.addressLine1');
        expect(drawer).toContain('rep?.email');
    });

    it('lets CDPH/WIC update both participant name parts from the Participant editor', () => {
        expect(medical).toContain('Participant First Name<input v-model="draft.participantFirstName"');
        expect(medical).toContain('Participant Last Name<input v-model="draft.participantLastName"');
        expect(drawer).toContain('participantName: `${firstName} ${lastName}`');
    });

    it('keeps participant name editing visible when approved-request details are collapsed', () => {
        expect(drawer).toContain('aria-label="Edit participant name"');
        expect(drawer).toContain('@click="editParticipantName"');
        expect(drawer).toContain('reviewDetailsExpanded.value = true;');
        expect(drawer).toContain("startEditing('participant');");
    });

    it('keeps request-form fields read-only until section editing and isolates issuance months to staff processing', () => {
        expect(drawer).toContain('>Edit</button>');
        expect(drawer).not.toContain('>Edit fields</button>');
        expect(medical).toContain('<span>Medical Office/Clinic</span>');
        expect(drawer).toContain('Prescription');
        expect(authorization).toContain('+ Add issuance month');
        expect(drawer).not.toContain('+ Add benefit month');
        expect(authorization).toContain('month-select');
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
        expect(medical.indexOf('<h3>Participant</h3>')).toBeLessThan(medical.indexOf('>Prescription</h3>'));
        expect(medical.indexOf('>Prescription</h3>')).toBeLessThan(medical.indexOf('<h3>WIC Food Restrictions</h3>'));
        expect(medical.indexOf('<h3>WIC Food Restrictions</h3>')).toBeLessThan(medical.indexOf('<h3>Health Care Provider</h3>'));
        expect(drawer.slice(drawer.indexOf('ref="shippingSection"'))).toContain('rep?.email');
    });

    it('keeps CDPH decisions and shipment together', () => {
        expect(drawer).not.toContain('Staff-only fields');
        expect(drawer).toContain('Are you sure you want to deny this request?');
        expect(drawer).toContain('v-if="pendingDecision"');
        expect(drawer).toContain('Confirm Denial');
        expect(drawer).not.toContain('window.confirm');
        expect(drawer).toContain('Review Decision');
        expect(drawer).toContain("canStaffEdit || request.status==='denied' || identity==='agency'");
        expect(drawer).toContain('Awaiting CDPH/WIC Decision');
        expect(drawer).toContain('Reason for Denial');
        expect(drawer).toContain('Edit review decision');
        expect(drawer).not.toContain('Undo approval or denial');
        expect(drawer.indexOf('<RequestMedicalDetails')).toBeLessThan(drawer.indexOf('<h3>Review Decision</h3>'));
        expect(drawer.indexOf('<h3>Request More Info</h3>')).toBeLessThan(drawer.indexOf('<h3>Review Decision</h3>'));
        expect(drawer).toContain('<span>Request More Info</span>');
        expect(drawer).toContain('class="review-details-toggle" type="button" :aria-expanded="moreInfoExpanded"');
        expect(drawer).toContain('canCollapseMoreInfo');
        expect(drawer).toContain('Next Steps');
        expect(drawer).toContain('class="cdph-fields" :disabled="draft.status === \'denied\'"');
        expect(drawer.indexOf('State-Issued Formula Authorization')).toBeLessThan(drawer.indexOf('<h3>Shipping</h3>'));
    });

    it('shows product metadata and combined approval quantities in CDPH processing', () => {
        expect(medical).toContain('<span>Formula Name</span>');
        expect(authorization).toContain('Product Number');
        expect(authorization).toContain('Units Per Case');
        expect(authorization).toContain('Yield');
        expect(authorization).toContain('Total Units Approved');
        expect(drawer).toContain('Assign Units');
        expect(drawer).toContain('On Hand</h4>');
        expect(drawer).toContain('<RequestSupplyPlan');
        expect(drawer).not.toContain('Amount Approved');
        expect(drawer).not.toContain('Expected Surplus Unit');
        expect(drawer).not.toContain('Agency Unit(s) On Hand');
        expect(drawer).not.toContain('Cases Ordered');
        expect(drawer).toContain('>Issuance</h3>');
        expect(drawer.indexOf('Issuance')).toBeLessThan(drawer.indexOf('<RequestAuthorizationFields'));
        expect(drawer.indexOf('Issuance')).toBeLessThan(drawer.indexOf('Next Steps'));
    });

    it('keeps approval pending for agencies until issuance is saved and hides the unfinished authorization',()=>{
        expect(list).toContain("function agencyIssuancePending(request:RequestRecord)");
        expect(list).toContain(":status=\"agencyIssuancePending(request)?'pending':request.status\"");
        expect(drawer).toContain('showAuthorizationWorkspace=computed(()=>canCollapseReviewDetails.value&&(canStaffEdit.value||hasSavedIssuance.value))');
        expect(drawer).toContain("RequestIssuanceSummary v-if=\"identity==='agency' && hasSavedIssuance\"");
        expect(drawer.indexOf('class="staff-save-action"')).toBeLessThan(drawer.indexOf('aria-label="Issuance supply plans"'));
        expect(drawer).toContain('v-if="canAccessShipping" ref="shippingSection"');
        expect(drawer).toContain('Save the issuance and supply plan before creating a shipment.');
        expect(drawer).toContain('Saving reserves those units; they remain in the On Hand balance');
        expect(drawer.indexOf('v-if="error" class="form-error" role="alert">{{error}}</p>')).toBeLessThan(drawer.indexOf('class="staff-save-action"'));
    });
});
