<script setup lang="ts">
import {submissionDateOnly} from '~/../shared/requestPresentation';
import {formatShippingAddress} from '~/../shared/shipping';
import {canEditSubmission} from '~/../shared/requestEditing';
import type { ProductForm, ProductRecord, RequestRecord } from '~/../shared/domain';
const props = defineProps<{ requests: RequestRecord[]; products: ProductRecord[] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const selected = ref<RequestRecord | null>(null);
const openError=ref('');
const selectedIndex = computed(() => props.requests.findIndex((request) => request.id === selected.value?.id));
const previousRequest = computed(() => props.requests[selectedIndex.value - 1]);
const nextRequest = computed(() => selectedIndex.value < 0 ? undefined : props.requests[selectedIndex.value + 1]);
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
    <div class="request-table-wrap">
        <div class="request-table-head">
            <span>Participant</span><span>Clinic</span><span>Product</span><span>Status</span><span>ETA</span><span />
        </div>
        <div v-for="request in requests" :key="request.id" class="request-row-shell">
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
                    <span
                        v-if="request.specialOrder"
                        class="request-tag"
                    >Special order</span>
                    <span
                        v-if="request.approved"
                        class="request-tag"
                    >Approved</span>
                </span><small>Submitted {{ formatDate(request.submissionDate) }}</small></span
            >
            <span
                ><strong>{{ request.eta ?? '—' }}</strong
                ><small>{{
                    request.trackingNumbers?.length
                        ? request.trackingNumbers.map((item) => item.number).join(', ')
                        : 'N/A'
                }}</small></span
            >
            <span class="row-arrow">›</span>
        </button>
        <NuxtLink v-if="identity === 'agency' && canEditSubmission(request)" class="request-edit-link" :to="{path:'/requests/new',query:{request:request.id}}" :aria-label="`Edit submission for ${request.participantName}`">Edit submission</NuxtLink>
        </div>
        <div
            v-if="!requests.length"
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
.request-row-shell {position:relative;}
.request-edit-link {position:absolute;right:12px;bottom:5px;padding:3px 6px;color:var(--purple-light);font-size:0.72rem;border-radius:4px;background:var(--surface);}
.request-edit-link:hover {text-decoration:underline;}
</style>
