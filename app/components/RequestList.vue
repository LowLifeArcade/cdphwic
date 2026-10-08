<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
defineProps<{ requests: RequestRecord[] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const selected = ref<RequestRecord | null>(null);
const { data: agencyData } = await useFetch('/api/agencies');
const agencies = computed(() => agencyData.value?.agencies ?? []);
const members = computed(() => agencyData.value?.members ?? []);

function formatDate(value?: string) {
    if (!value) {
        return '—';
    }
    const [year, month, day] = value.split('-');
    return year && month && day ? `${month}/${day}/${year}` : value;
}

const selectedAgency = computed(() => agencies.value.find((agency) => agency.id === selected.value?.agencyId));
const selectedRep = computed(() => members.value.find((member) => member.id === selected.value?.agencyMemberId));
function agencyFor(request: RequestRecord) {
    return agencies.value.find((agency) => agency.id === request.agencyId);
}

async function openRequest(request: RequestRecord) {
    selected.value = request;
    if ((identity.value === 'admin' || identity.value === 'internal') && request.status === 'unopened') {
        const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${request.id}`, {
            method: 'PUT',
            body: { status: 'opened' },
        });
        Object.assign(request, result.request);
    }
}
</script>

<template>
    <div class="request-table-wrap">
        <div class="request-table-head">
            <span>Participant</span><span>Agency</span><span>Product</span><span>Status</span><span>ETA</span><span />
        </div>
        <button
            v-for="request in requests"
            :key="request.id"
            class="request-row"
            @click="openRequest(request)"
        >
            <span
                ><strong>{{ request.participantName }}</strong
                ><small
                    >{{ request.requestKind === 'extension' ? 'Extension' : 'New' }} · family
                    {{ request.participantFamilyId ?? '—' }}</small
                ></span
            >
            <span
                ><strong>{{
                    request.agencyId === 10
                        ? 'Mendocino County'
                        : request.agencyId === 11
                          ? 'Lake County'
                          : 'Sonoma County'
                }}</strong
                ><small>{{ agencyFor(request)?.shippingAddress ?? 'Local agency' }}</small></span
            >
            <span
                ><strong>{{ request.productName }}</strong
                ><small
                    v-if="request.specialOrder"
                    class="request-tag"
                    >Special order</small
                ><small>{{ request.unitsRequested ?? '—' }} units</small></span
            >
            <span
                ><StatusBadge :status="request.status" /><small>Submitted {{ formatDate(request.submissionDate) }}</small></span
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
        <div
            v-if="!requests.length"
            class="empty-state"
        >
            No requests match this view.
        </div>
        <RequestDetailDrawer
            v-if="selected"
            :request="selected"
            :agency="selectedAgency"
            :rep="selectedRep"
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
