<script setup lang="ts">
import {showDamageRequirements} from '~/../shared/distributors';
import type {RequestRecord} from '~/../shared/domain';
import type {RequestShipment} from '~/../shared/requestShipments';
import {shipmentReceiptKey} from '~/../shared/shipmentReceipts';
import {activeShipmentIssue,shipmentIssueKey,type ShipmentIssueCommand,type ShipmentIssueType} from '~/../shared/shipmentIssues';
import {formatEtaDate,submissionDateOnly} from '~/../shared/requestPresentation';
const props=defineProps<{request:RequestRecord;shipment:RequestShipment;index:number;canReport:boolean;catalogUnitsPerCase?:number;disabled?:boolean;receiptEditing?:boolean}>();
const emit=defineEmits<{updated:[request:RequestRecord]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const editing=ref(false);
const deleting=ref(false);
const responding=ref(false);
const canRespond=computed(()=>identity.value==='admin' || identity.value==='internal');
const issueType=ref<ShipmentIssueType>('damaged');
const notes=ref('');
const expectedIssue=ref('');
const shipmentKey=ref('');
const saving=ref(false);
const error=ref('');
const feedback=ref('');
function startUpdate() {
    responding.value=false;
    issueType.value=props.shipment.issue?.type ?? 'damaged';
    notes.value=props.shipment.issue?.notes ?? '';
    expectedIssue.value=shipmentIssueKey(props.shipment);
    shipmentKey.value=shipmentReceiptKey(props.shipment);
    error.value='';feedback.value='';editing.value=true;
}
function startDelete() {
    expectedIssue.value=shipmentIssueKey(props.shipment);
    shipmentKey.value=shipmentReceiptKey(props.shipment);
    deleting.value=true;error.value='';feedback.value='';
}
function startResponse() {
    responding.value=true;editing.value=true;notes.value='';
    expectedIssue.value=shipmentIssueKey(props.shipment);
    shipmentKey.value=shipmentReceiptKey(props.shipment);
    error.value='';feedback.value='';
}
async function submitIssue(action:ShipmentIssueCommand['action']) {
    const requestId=props.request.id;
    const command:ShipmentIssueCommand={index:props.index,key:(action==='report'||action==='update'||action==='respond'||action==='delete')?shipmentKey.value:shipmentReceiptKey(props.shipment),expectedIssue:(action==='report'||action==='update'||action==='respond'||action==='delete')?expectedIssue.value:shipmentIssueKey(props.shipment),action,...((action==='report'||action==='update')?{type:issueType.value,notes:notes.value}:action==='respond'?{notes:notes.value}:{})};
    saving.value=true;error.value='';feedback.value='';
    try {
        const result=await $fetch<{request:RequestRecord}>(`/api/requests/${requestId}`,{method:'PUT',headers:{'x-demo-user':identity.value},body:{shipmentIssue:command}});
        emit('updated',result.request);
        editing.value=false;deleting.value=false;
        feedback.value=action==='delete'?'Shipment issue deleted.':action==='update'?'Shipment issue updated.':action==='reopen'?'Shipment issue reopened.':action==='report'?'Shipment issue reported.':action==='respond'?'Response saved.':action==='resolve-received'?'Issue resolved and shipment marked received.':'Shipment issue resolved.';
    } catch (failure) {
        const detail=failure as {data?:{statusMessage?:string};statusMessage?:string};
        error.value=detail.data?.statusMessage ?? detail.statusMessage ?? 'The shipment issue could not be saved. Please try again.';
    } finally {saving.value=false;}
}
</script>

<template>
    <div v-if="shipment.issue && !receiptEditing" class="shipment-issue-panel">
        <div v-if="shipment.issue" :class="['shipment-issue-details',{'shipment-issue-active':!shipment.issue.resolvedAt}]">
            <strong>{{shipment.issue.resolvedAt?'Resolved issue':'Shipment issue'}} — {{ {damaged:'Damaged',missing:'Missing',incomplete:'Incomplete'}[shipment.issue.type] }}</strong>
            <p v-if="shipment.issue.notes" class="issue-notes">{{shipment.issue.notes}}</p>
            <small>Reported {{formatEtaDate(submissionDateOnly(shipment.issue.reportedAt))}}<template v-if="shipment.issue.resolvedAt"> · Resolved {{formatEtaDate(submissionDateOnly(shipment.issue.resolvedAt))}}</template><template v-if="shipment.issue.reopenedAt"> · Reopened {{formatEtaDate(submissionDateOnly(shipment.issue.reopenedAt))}}</template></small>
        </div>
        <ShipmentRequirementsPanel v-if="showDamageRequirements(identity,shipment,editing && !responding && issueType==='damaged')" :shipment="shipment" />
        <ShipmentEvidencePanel v-if="shipment.issue" :request="request" :shipment="shipment" :index="index" :can-provide="canReport" @updated="record=>emit('updated',record)" />
        <div v-if="shipment.issue?.responses?.length" class="issue-responses">
            <div v-for="(response,responseIndex) in shipment.issue.responses" :key="responseIndex" class="issue-response">
                <strong>CDPH/WIC Response</strong>
                <p class="issue-notes">{{response.notes}}</p>
                <small>{{formatEtaDate(submissionDateOnly(response.createdAt))}}</small>
            </div>
        </div>
        <div v-if="canRespond && activeShipmentIssue(shipment) && !editing" class="issue-actions">
            <button class="button button-secondary" type="button" :disabled="disabled || saving" :aria-label="`Respond to issue for shipment ${index+1}`" @click="startResponse">Respond to Issue</button>
        </div>
        <div v-if="shipment.issue && !editing" class="issue-actions">
            <button v-if="canRespond" class="button button-ghost" type="button" :disabled="disabled || saving" :aria-label="`Update issue for shipment ${index+1}`" @click="startUpdate">Update Issue</button>
            <button v-if="shipment.issue?.resolvedAt" class="button button-secondary" type="button" :disabled="disabled || saving" :aria-label="`Reopen issue for shipment ${index+1}`" @click="submitIssue('reopen')">Reopen Issue</button>
            <button v-if="canReport && activeShipmentIssue(shipment)" class="button button-secondary" type="button" :disabled="disabled || saving" :aria-label="`Resolve issue for shipment ${index+1}`" @click="submitIssue('resolve')">Mark Issue Resolved</button>
        </div>
        <div v-if="canReport && shipment.issue && !editing" class="issue-actions">
            <button class="button button-ghost" type="button" :disabled="disabled || saving" :aria-label="`Delete issue for shipment ${index+1}`" @click="startDelete">Delete Issue</button>
        </div>
        <div v-if="deleting" class="issue-delete-confirmation" role="alertdialog" aria-label="Delete shipment issue" aria-modal="false">
            <p>Are you sure you want to delete this issue report?</p>
            <p class="muted-copy">Received quantities and documented returns or destruction will be kept.</p>
            <div class="issue-actions"><button class="button button-secondary" type="button" :disabled="disabled || saving" @click="submitIssue('delete')">Delete Issue Report</button><button class="button button-ghost" type="button" :disabled="saving" @click="deleting=false">Cancel</button></div>
        </div>
        <div v-if="editing" class="issue-editor">
            <label v-if="!responding" class="field-label">Issue Type<select v-model="issueType" class="form-input" :aria-label="`Shipment ${index+1} issue type`" :disabled="saving"><option value="damaged">Damaged</option><option value="missing">Missing</option><option value="incomplete">Incomplete</option></select></label>
            <label class="field-label">{{responding?'Response':'Issue Notes'}}<textarea v-model="notes" class="form-textarea" maxlength="4000" :placeholder="responding?'Enter a response to the local agency.':'Describe the issue with this shipment.'" :aria-label="responding?`Shipment ${index+1} response`:`Shipment ${index+1} issue notes`" :disabled="saving" /></label>
            <div class="issue-actions">
                <button class="button button-secondary" type="button" :disabled="disabled || saving" @click="submitIssue(responding?'respond':'update')">{{saving?'Saving…':responding?'Send Response':'Save Issue Update'}}</button>
                <button class="button button-ghost" type="button" :disabled="saving" @click="editing=false;error=''">Cancel</button>
            </div>
        </div>
        <p v-if="error" class="issue-error" role="alert">{{error}}</p>
        <p v-if="feedback" role="status">{{feedback}}</p>
    </div>
</template>

<style scoped>
.shipment-issue-panel {margin-top:12px;}
.shipment-issue-details {padding:12px;border:1px solid var(--line);border-radius:8px;}
.shipment-issue-active {border-color:var(--red);}
.issue-notes {white-space:pre-wrap;margin:8px 0;overflow-wrap:anywhere;}
.issue-actions {display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px;}
.issue-responses {display:grid;gap:12px;margin-top:12px;}
.issue-response {border-left:3px solid #902A92;padding-left:12px;}
.issue-editor {display:grid;gap:12px;margin-top:12px;}
.issue-error {color:var(--red);}
</style>
