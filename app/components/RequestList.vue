<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
defineProps<{ requests: RequestRecord[] }>();
const selected = ref<RequestRecord | null>(null);
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
            @click="selected = request"
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
                ><small>{{ request.unitsRequested ?? '—' }} units</small></span
            >
            <span
                ><StatusBadge :status="request.status" /><small>{{ request.submissionDate ?? 'No date' }}</small></span
            >
            <span
                ><strong>{{ request.eta ?? '—' }}</strong
                ><small>{{ request.trackingNumber ?? 'No tracking' }}</small></span
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
            :request="selected"
            @close="selected = null"
        />
    </div>
</template>
