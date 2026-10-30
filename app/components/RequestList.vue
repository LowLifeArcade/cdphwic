<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import {caseBalance,shipmentListSummary} from '~/../shared/shipmentCaseTracking';
import {localDate} from '~/../shared/surplus';
import {deliveryCategory,filterAndSortRequests,type DeliveryFilter,type RequestTagFilter,type RequestListSort} from '~/../shared/requestListFilters';
import {formatEtaDate,submissionDateOnly} from '~/../shared/requestPresentation';
import {formatShippingAddress} from '~/../shared/shipping';
import {canEditSubmission} from '~/../shared/requestEditing';
import type { ProductForm, ProductRecord, RequestRecord } from '~/../shared/domain';
const props = defineProps<{ requests: RequestRecord[]; products: ProductRecord[] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const selected = ref<RequestRecord | null>(null);
const openError=ref('');
const listToday=ref(localDate());
function shippingSummary(request:RequestRecord) {return shipmentListSummary(request,listToday.value);}
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

function formatForm(form?: ProductForm) {
    return form ? {powder:'Powder', concentrate:'Liquid Concentrate', 'ready-to-feed':'Ready-to-Feed'}[form] ?? '—' : '—';
}

function formatDate(value?: string) {
    if (!value) {
        return '—';
    }
    const [year, month, day] = submissionDateOnly(value).split('-');
    return year && month && day ? `${month}/${day}/${year}` : value;
}

const selectedAgency = computed(() => agencies.value.find((agency) => agency.id === selected.value?.agencyId));
const selectedRep = computed(() => members.value.find((member) => member.id === selected.value?.agencyMemberId));

async function openRequest(request: RequestRecord) {
    if (request.status === 'incomplete') {
        await navigateTo(`/requests/new?draft=${request.id}`);
        return;
    }
    openError.value='';
    if ((identity.value === 'admin' || identity.value === 'internal') && request.status === 'unopened') {
        try { const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${request.id}`, {
            method: 'PUT',
            headers: {'x-demo-user':identity.value},
            body: { status: 'opened' },
        });
        Object.assign(request, result.request);
        } catch {openError.value='The request could not be opened. Please refresh and try again.';return;}
    }
    selected.value=request;
}
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
            <span
                ><strong>{{ request.participantName }}</strong
                ><small
                    >{{ request.requestKind === 'extension' ? 'Extension' : 'New' }} ·
                    {{ request.participantFamilyId ?? '—' }}</small
                ></span
            >
            <span :title="formatShippingAddress(request.shipping)"
                ><strong>{{ agencies.find(agency => agency.id === request.agencyId)?.name || '—' }}</strong
                ><small>{{ formatShippingAddress(request.shipping) }}</small></span
            >
            <span
                ><strong>{{ request.productName }}</strong
                ><small>{{ formatForm(request.productForm ?? request.requestedFormulas?.[0]?.productForm) }}</small></span
            >
            <span
                ><span class="request-status-tags">
                    <StatusBadge :status="request.status" />
                    <span v-if="identity!=='agency' && needsCaseReview(request)" class="request-tag shipping-issue-tag">Case Count Review</span>
                    <span v-if="deliveryCategory(request) === 'issue'" class="request-tag shipping-issue-tag">Shipping Issue</span>
                    <span
                        v-if="request.specialOrder"
                        class="request-tag"
                    >Special order</span>
                    <span
                        v-if="request.approved"
                        class="request-tag"
                    >Approved</span>
                </span><small v-if="shippingSummary(request).total">{{shippingSummary(request).received}} of {{shippingSummary(request).total}} fully received<template v-if="shippingSummary(request).replaced"> · {{shippingSummary(request).replaced}} replaced</template></small><small>Submitted {{ formatDate(request.submissionDate) }}</small></span
            >
            <span class="shipment-eta-cell" :title="shippingSummary(request).nextEta ? `Next ETA: ${formatEtaDate(shippingSummary(request).nextEta)}` : undefined">
                <strong :class="{'eta-overdue':shippingSummary(request).overdue}">{{shippingSummary(request).nextEta ? formatEtaDate(shippingSummary(request).nextEta) : shippingSummary(request).total && !shippingSummary(request).awaiting ? 'All deliveries closed' : 'ETA pending'}}</strong>
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
.request-list-controls {margin-bottom:16px;gap:12px;}
.request-list-controls label {display:flex;align-items:center;gap:8px;}
.shipment-eta-cell small {white-space:normal;overflow:visible;text-overflow:clip;}
.eta-overdue {color:var(--danger-text);}
.shipping-issue-tag {color:#FFFFFF;background:#AE5018;border-color:#AE5018;}
.request-row-shell {position:relative;}
.request-edit-link {position:absolute;right:12px;bottom:5px;padding:3px 6px;color:var(--purple-light);font-size:0.72rem;border-radius:4px;background:var(--surface);}
.request-edit-link:hover {text-decoration:underline;}
</style>
