<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
defineProps<{ requests: RequestRecord[] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const selected = ref<RequestRecord | null>(null);

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
            <span>Request</span><span>Agency</span><span>Product</span><span>Status</span><span>ETA</span><span />
        </div>
        <button
            v-for="request in requests"
            :key="request.id"
            class="request-row"
            @click="openRequest(request)"
        >
            <span
                ><strong>#{{ request.id }}</strong
                ><small>{{ request.participantName }} · family {{ request.participantFamilyId ?? '—' }}</small></span
            >
            <span
                ><strong>{{
                    request.agencyId === 10
                        ? 'Mendocino County'
                        : request.agencyId === 11
                          ? 'Lake County'
                          : 'Sonoma County'
                }}</strong
                ><small>Rep #{{ request.agencyMemberId }}</small></span
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
                ><StatusBadge :status="request.status" /><small>{{ request.submissionDate ?? 'No date' }}</small></span
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
