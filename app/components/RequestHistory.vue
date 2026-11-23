<script setup lang="ts">
import type {RequestRecord} from '~/../shared/domain';
import type {ParticipantHistory} from '~/../shared/requestHistory';
import {formatDisplayDate,requestFormulas,requestedMonthLabels,foodRestrictionLabel} from '~/../shared/requestPresentation';
import {formulaAuthorizations,formatIssuanceMonth} from '~/../shared/formulaAuthorizations';
import {requestShipments} from '~/../shared/requestShipments';
import {formatShippingAddress} from '~/../shared/shipping';
const props = defineProps<{familyId:string;individualId:string;name:string;dob:string;currentId?:number;context:'form'|'review';suspended?:boolean}>();
const emit = defineEmits<{preview:[open:boolean]}>();
const identity = useState<'admin'|'agency'|'internal'>('demo-identity',()=>'admin');
const history = ref<ParticipantHistory>();
const loading = ref(false);
const error = ref('');
const selected = ref<RequestRecord>();
const attachmentOpen = ref(false);
const pane = ref<HTMLElement>();
const ready = computed(()=>!!props.familyId.trim() && !!props.individualId.trim());
function close() {selected.value=undefined;attachmentOpen.value=false;emit('preview',false);}
watch(()=>props.suspended,value=>{if(value)close();});
async function open(request:RequestRecord) {selected.value=request;attachmentOpen.value=false;emit('preview',true);await nextTick();pane.value?.focus();}
let generation=0;
async function load(current:number) {
    if(!ready.value)return;
    loading.value=true;
    error.value='';
    try {
        const result=await $fetch<ParticipantHistory>('/api/requests/history',{method:'POST',headers:{'x-demo-user':identity.value},body:{familyId:props.familyId,individualId:props.individualId,name:props.name,dob:props.dob,currentId:props.currentId}});
        if(current===generation)history.value=result;
    } catch {if(current===generation)error.value='Prior requests could not be loaded. Please try again. You can continue with this request.';}
    finally {if(current===generation)loading.value=false;}
}
watch(()=>[props.familyId,props.individualId,props.name,props.dob,props.currentId,identity.value],(_value,_old,onCleanup)=>{
    const current=++generation;
    history.value=undefined;error.value='';loading.value=ready.value;close();
    if(!import.meta.client)return;
    const timer=setTimeout(()=>load(current),350);
    onCleanup(()=>{clearTimeout(timer);generation++;});
},{immediate:true});
onBeforeUnmount(()=>{generation++;emit('preview',false);});
</script>
<template>
    <section class="prior-request-history" aria-label="Prior requests">
        <h3>Prior Requests<span v-if="history"> ({{history.matches.length}})</span></h3>
        <p v-if="!ready">Enter both WIC Family ID and WIC Individual ID to look up prior requests.</p>
        <p v-else-if="loading" role="status">Checking prior requests…</p>
        <p v-else-if="error" role="alert">{{error}} <button type="button" class="text-button" @click="load(++generation)">Retry</button></p>
        <template v-else-if="history">
            <div v-if="history.warnings.length" class="history-warning" role="status"><p v-for="warning in history.warnings" :key="warning">{{warning}}</p><small v-if="context==='form'">These checks do not prevent submission.</small></div>
            <ul v-if="history.matches.length" class="history-list">
                <li v-for="row in history.matches" :key="row.id"><button type="button" class="history-link" @click="open(row)"><strong>Request #{{row.id}} · {{formatDisplayDate(row.submissionDate)}}</strong><span>{{row.productName}} · {{row.requestKind==='extension'?'Extension':'New'}}</span><StatusBadge :status="row.status" /></button></li>
            </ul>
            <div v-if="history.possibleMatches.length"><h4>Possible matches — verify WIC IDs</h4><ul class="history-list"><li v-for="row in history.possibleMatches" :key="row.id"><button type="button" class="history-link" @click="open(row)"><strong>{{row.participantName}} · Request #{{row.id}}</strong><span>{{formatDisplayDate(row.submissionDate)}} · {{row.productName}}</span></button></li></ul></div>
        </template>
    </section>
    <Teleport to="body">
    <section v-if="selected" ref="pane" tabindex="-1" :class="context==='review'?'request-document-pane':'form-history-pane'" class="history-pane" aria-label="Prior request reference" @click.stop @keydown.esc.stop="close">
        <div class="document-pane-header"><strong>Prior Request #{{selected.id}} · Read only</strong><button type="button" class="button button-secondary" @click="close">Close reference</button></div>
        <div class="history-content">
            <h2>{{selected.participantName}}</h2><StatusBadge :status="selected.status" />
            <dl class="history-details">
                <dt>Submitted</dt><dd>{{formatDisplayDate(selected.submissionDate)}} · {{selected.requestKind==='extension'?'Extension':'New'}}</dd>
                <dt>WIC Family ID / Individual ID</dt><dd>{{selected.participantFamilyId??'—'}} / {{selected.wicIndividualId??'—'}}</dd>
                <dt>Date of birth</dt><dd>{{formatDisplayDate(selected.participantDob)}}</dd>
                <dt>Benefits start date</dt><dd>{{formatDisplayDate(selected.benefitsStartDate)}}</dd>
                <dt>Requested months</dt><dd>{{requestedMonthLabels(selected.benefitMonthsRequested)||'—'}}</dd>
                <dt>Diagnosis</dt><dd>{{selected.diagnosis||'—'}}</dd>
                <dt>Food restrictions</dt><dd>{{foodRestrictionLabel(selected.wicFoodRestrictions)}} {{selected.wicFoodRestrictionDetails}}</dd>
                <dt>Nutrition staff notes</dt><dd>{{selected.wicNutritionStaffNotes||'—'}}</dd>
                <dt>Provider</dt><dd>{{selected.doctorPrintedName||'—'}} · {{selected.doctorOfficeName}} · {{selected.doctorOfficePhone}}</dd>
                <dt>Prescription signed</dt><dd>{{formatDisplayDate(selected.prescriptionSignedDate)}}</dd>
                <dt>Shipping address</dt><dd>{{formatShippingAddress(selected.shipping)}}</dd>
                <dt>Representative notes</dt><dd>{{selected.repNotes||'—'}}</dd>
            </dl>
            <h3>Requested formula</h3>
            <div v-for="(formula,index) in requestFormulas(selected)" :key="index" class="history-formula"><strong>{{formula.productName}}</strong><p>{{formula.productForm}} · {{formula.flavor||'Unflavored'}} · {{formula.ouncesPrescribed??'—'}} oz/day</p><p v-if="formula.readyToFeedJustification">{{formula.readyToFeedJustification}}</p></div>
            <p>Duration: {{selected.durationMonths??'—'}} months</p>
            <template v-if="selected.approved || selected.approvalDate"><h3>Approval and issuance</h3><p>Approved {{formatDisplayDate(selected.approvalDate)}}<template v-if="selected.approvedByName"> by {{selected.approvedByName}}</template></p><div v-for="(authorization,index) in formulaAuthorizations(selected)" :key="index" class="history-formula"><strong>{{authorization.formulaName || authorization.productName}}</strong><ul><li v-for="issuance in authorization.benefitIssuances" :key="issuance.month">{{formatIssuanceMonth(issuance.month)}}: {{issuance.quantity}} units</li></ul></div></template>
            <p v-if="selected.denialReason"><strong>Denial reason:</strong> {{selected.denialReason}}</p>
            <template v-if="selected.shipments?.length"><h3>Deliveries</h3><ul><li v-for="(shipment,index) in requestShipments(selected)" :key="index">ETA {{formatDisplayDate(shipment.eta)}} · {{shipment.casesShipped}} cases · {{shipment.carrier}}<template v-if="shipment.trackingNumbers?.length"> · {{shipment.trackingNumbers.join(', ')}}</template></li></ul></template>
            <template v-if="selected.prescriptionAttachment"><button type="button" class="button button-secondary" :aria-expanded="attachmentOpen" @click="attachmentOpen=!attachmentOpen">{{attachmentOpen?'Hide':'View'}} prior medical documentation</button><RequestDocumentPreview v-if="attachmentOpen" :key="selected.id" :request-id="selected.id" :attachment="selected.prescriptionAttachment" /></template>
        </div>
    </section>
    </Teleport>
</template>
<style scoped>
.prior-request-history {margin:16px 0;padding:16px;border:1px solid var(--border);border-radius:8px;}
.prior-request-history h3 {margin-top:0;}
.history-list {list-style:none;padding:0;display:grid;gap:8px;}
.history-link {display:flex;flex-direction:column;align-items:flex-start;gap:5px;width:100%;padding:12px;text-align:left;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;cursor:pointer;}
.history-link:hover {text-decoration:underline;}
.history-warning {padding:12px;border-left:3px solid var(--warning-text,#ae5018);background:var(--surface-raised);}
.history-warning p {margin:0 0 8px;}
.history-pane {overflow:auto;}
.form-history-pane {position:fixed;z-index:40;inset:0 0 0 auto;width:45vw;background:var(--surface);border-left:1px solid var(--border);}
.history-content {padding:24px;overflow:auto;}
.history-details dt {font-weight:700;margin-top:12px;}
.history-details dd {margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere;}
.history-formula {border-bottom:1px solid var(--border);padding:12px 0;}
@media(max-width:900px) {.form-history-pane {width:100vw;height:45dvh;top:auto;}.history-content {padding:16px;}}
</style>
