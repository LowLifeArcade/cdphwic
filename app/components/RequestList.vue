<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import {caseBalance,shipmentListSummary} from '~/../shared/shipmentCaseTracking';
import {localDate} from '~/../shared/surplus';
import {deliveryCategory,filterAndSortRequests,type DeliveryFilter,type RequestTagFilter,type RequestListSort} from '~/../shared/requestListFilters';
import {formulaOrders,allFormulasSpecialOrder,hasFormulaAwaitingEta} from '~/../shared/formulaOrders';
import {formatEtaDate,formatDisplayDate,formulaFormLabel} from '~/../shared/requestPresentation';
import {formatShippingAddress} from '~/../shared/shipping';
import {canEditSubmission,hasPendingMoreInfo} from '~/../shared/requestEditing';
import type { ProductRecord, RequestRecord } from '~/../shared/domain';
const props = defineProps<{ requests: RequestRecord[]; products: ProductRecord[] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const selected = ref<RequestRecord | null>(null);
const route=useRoute();

const openError=ref('');
const listToday=ref(localDate());
function shippingSummary(request:RequestRecord) {return shipmentListSummary(request,listToday.value);}
function etaLabel(request:RequestRecord){
    const summary=shippingSummary(request);
    if(summary.nextEta)return formatEtaDate(summary.nextEta);
    if(request.status==='complete' && summary.total && !summary.awaiting)return 'All deliveries closed';
    if((request.approved===true||request.status==='approved') && hasFormulaAwaitingEta(request,true))return 'ETA pending';
    if(hasFormulaAwaitingEta(request))return '';
    return summary.total&&!summary.awaiting?'All deliveries closed':'';
}
const shipmentFeatures=shipmentFeatureFlags(useRuntimeConfig().public);
function needsCaseReview(request:RequestRecord) {if(!shipmentFeatures.caseReconciliation&&!shipmentFeatures.potentialOverDelivery)return false;const balance=caseBalance(request);return (shipmentFeatures.caseReconciliation&&(balance.excess>0||balance.needsApproval))||(shipmentFeatures.potentialOverDelivery&&balance.projectedExcess>0);}
const deliveryFilter = ref<DeliveryFilter>('all');
const tagFilter = ref<RequestTagFilter>('all');
const sortBy = ref<RequestListSort>('submitted');
const visibleRequests = computed(()=>filterAndSortRequests(props.requests,deliveryFilter.value,tagFilter.value,sortBy.value));
watch(identity,()=>{selected.value=null;});
const selectedIndex = computed(() => visibleRequests.value.findIndex((request) => request.id === selected.value?.id));
const previousRequest = computed(() => visibleRequests.value[selectedIndex.value - 1]);
const nextRequest = computed(() => selectedIndex.value < 0 ? undefined : visibleRequests.value[selectedIndex.value + 1]);
const { data: agencyData } = await useFetch('/api/agencies');
const agencies = computed(() => agencyData.value?.agencies ?? []);
const members = computed(() => agencyData.value?.members ?? []);

const selectedAgency = computed(() => agencies.value.find((agency) => agency.id === selected.value?.agencyId));
const selectedRep = computed(() => members.value.find((member) => member.id === selected.value?.agencyMemberId));

async function openRequest(request: RequestRecord) {
    if (request.status === 'incomplete') {
        await navigateTo(`/requests/new?draft=${request.id}`);
        return;
    }
    openError.value='';
    try {
        const result=await $fetch<{request:RequestRecord}>(`/api/requests/${request.id}`,{headers:{'x-demo-user':identity.value}});
        Object.assign(request,result.request);
        if(import.meta.client)window.dispatchEvent(new Event('request-messages-changed'));
    } catch {openError.value='The request could not be opened. Please refresh and try again.';return;}
    selected.value=request;
    if(import.meta.client&&route.hash===`#more-info-${request.id}`){await nextTick();document.getElementById(`more-info-${request.id}`)?.scrollIntoView({block:'start'});}
}
async function openMessageRequest(event:Event){const id=(event as CustomEvent<number>).detail;if(String(route.query.request)!==String(id))return;const request=props.requests.find(row=>row.id===id);if(request){await openRequest(request);await nextTick();document.getElementById(`more-info-${id}`)?.scrollIntoView({block:'start'});}}
onMounted(()=>window.addEventListener('open-request-message',openMessageRequest));
onBeforeUnmount(()=>window.removeEventListener('open-request-message',openMessageRequest));
watch([()=>route.query.request,()=>props.requests],async([id],[previousId])=>{const request=props.requests.find(r=>String(r.id)===String(id));if(!request)return;if(selected.value?.id===request.id && id===previousId){if(selected.value!==request)Object.assign(selected.value,request);}else await openRequest(request);},{immediate:true});
</script>

<template>
    <p v-if="openError" role="alert">{{openError}}</p>
    <div class="filter-bar request-list-controls">
        <label>Delivery<select v-model="deliveryFilter" class="filter-select"><option value="all">All deliveries</option><option value="awaiting">Awaiting Receipt</option><option value="partial">Partially Received</option><option value="received">Fully Received</option><option value="issue">Shipment Issue</option></select></label>
        <label>Tags<select v-model="tagFilter" class="filter-select"><option value="all">All tags</option><option value="new">New</option><option value="extension">Extension</option><option value="approved">Approved</option><option value="special">Special Order</option></select></label>
        <label>Sort by<select v-model="sortBy" class="filter-select"><option value="submitted">Submitted Date (newest first)</option><option value="eta">ETA (earliest first)</option><option value="participant">Participant Name (A–Z)</option></select></label>
        <span class="muted-copy">{{visibleRequests.length}} shown</span>
    </div>
    <div class="request-table-wrap">
        <div class="request-table-head">
            <span>Participant</span><span>Clinic</span><span>Product</span><span>Status</span><span>ETA</span><span />
        </div>
        <div v-for="request in visibleRequests" :key="request.id" class="request-row-shell">
        <button
            class="request-row"
            @click="openRequest(request)"
        >
            <span>
                <strong>{{ request.participantName }}</strong>
                <span class="participant-request-meta">
                    <span class="request-tag request-kind-tag">{{ request.requestKind === 'extension' ? 'Extension' : 'New' }}</span>
                    <small>{{ request.participantFamilyId ?? '—' }}</small>
                </span>
            </span>
            <span :title="formatShippingAddress(request.shipping)"
                ><strong>{{ agencies.find(agency => agency.id === request.agencyId)?.name || '—' }}</strong
                ><small>{{ formatShippingAddress(request.shipping) }}</small></span
            >
            <span class="request-formula-list">
                <span v-for="(formula,index) in formulaOrders(request)" :key="index" class="request-formula-item">
                    <strong>{{formula.productName}}</strong>
                    <small>{{formulaFormLabel(formula.productForm)}}<template v-if="formula.flavor"> · {{formula.flavor}}</template><span v-if="formula.specialOrder" class="status-badge status-special-order formula-order-tag">Special Order</span></small>
                </span>
            </span>
            <span
                ><span class="request-status-tags">
                    <StatusBadge v-if="!hasPendingMoreInfo(request) && !(allFormulasSpecialOrder(request) && request.status==='in_progress')" :status="request.status" />
                <span v-if="hasPendingMoreInfo(request)" class="request-tag more-info-status" title="Returned to Local Agency for more information" role="status">Pending More Info</span>
                    <span v-if="identity!=='agency' && needsCaseReview(request)" class="request-tag shipping-issue-tag">Case Count Review</span>
                    <span v-if="deliveryCategory(request) === 'issue'" class="request-tag shipping-issue-tag">Shipping Issue</span>
                    <span
                        v-if="allFormulasSpecialOrder(request)"
                        class="status-badge status-special-order"
                    >Special Order</span>
                    <span
                        v-if="request.approved && request.status!=='complete'"
                        class="request-tag"
                    >Approved</span>
                </span><small v-if="shippingSummary(request).total">{{shippingSummary(request).received}} of {{shippingSummary(request).total}} fully received<template v-if="shippingSummary(request).replaced"> · {{shippingSummary(request).replaced}} replaced</template></small><small>Submitted {{ formatDisplayDate(request.submissionDate) }}</small></span
            >
            <span class="shipment-eta-cell" :title="shippingSummary(request).nextEta ? `Next ETA: ${formatEtaDate(shippingSummary(request).nextEta)}` : undefined">
                <strong :class="{'eta-overdue':shippingSummary(request).overdue}">{{etaLabel(request)}}</strong>
                <small v-if="shippingSummary(request).awaiting">{{shippingSummary(request).awaiting}} awaiting receipt<template v-if="shippingSummary(request).overdue"> · Overdue</template></small>
            </span>
            <span class="row-arrow">›</span>
        </button>
        <NuxtLink v-if="identity === 'agency' && canEditSubmission(request)" class="request-edit-link" :to="{path:'/requests/new',query:{request:request.id}}" :aria-label="`Edit submission for ${request.participantName}`">Edit submission</NuxtLink>
        </div>
        <div
            v-if="!visibleRequests.length"
            class="empty-state"
        >
            No requests match this view.
        </div>
        <RequestDetailDrawer
            v-if="selected"
            :key="selected.id"
            :request="selected"
            :products="props.products"
            :agency="selectedAgency"
            :rep="selectedRep"
            :has-previous="!!previousRequest"
            :has-next="!!nextRequest"
            @previous="previousRequest && openRequest(previousRequest)"
            @next="nextRequest && openRequest(nextRequest)"
            @close="selected = null"
        />
        <button
            v-if="selected"
            class="request-drawer-backdrop"
            type="button"
            aria-label="Close request details"
            @click="selected = null"
        />
    </div>
</template>

<style scoped>
.request-row > .request-formula-list {gap:12px;}
.request-formula-item {display:block;min-width:0;max-width:100%;}
.request-formula-item strong {display:block;white-space:normal;overflow-wrap:anywhere;line-height:1.4;}
.request-formula-item small {display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.4;}
.request-formula-item .formula-order-tag {flex-shrink:0;}
.request-list-controls {margin-bottom:16px;gap:12px;}
.request-list-controls label {display:flex;align-items:center;gap:8px;}
.shipment-eta-cell small {white-space:normal;overflow:visible;text-overflow:clip;}
.eta-overdue {color:var(--danger-text);}
.shipping-issue-tag {color:#FFFFFF;background:#AE5018;border-color:#AE5018;}
.request-row-shell {position:relative;}
.request-edit-link {position:absolute;right:12px;bottom:5px;padding:3px 6px;color:var(--purple-light);font-size:0.72rem;border-radius:4px;background:var(--surface);}
.request-edit-link:hover {text-decoration:underline;}
</style>

<style scoped>
.participant-request-meta {display:flex;align-items:center;gap:8px;min-width:0;}
.participant-request-meta .request-kind-tag {flex-shrink:0;}
</style>
