<script setup lang="ts">
import type { AccessRequest } from '~/../shared/accessFlow';
const requests = ref<AccessRequest[]>([]);
const message = ref('');
async function load() {
    const result = await $fetch<{ requests: AccessRequest[] }>('/api/access-requests');
    requests.value = result.requests;
}
async function approve(request: AccessRequest) {
    const result = await $fetch<{ message: string }>(`/api/access-requests/${request.id}/approve`, {
        method: 'POST',
        body: { invitationType: request.requestedMemberType === 'agency' ? 'agency_rep' : 'staff' },
    });
    message.value = result.message;
    await load();
}
async function deny(request: AccessRequest) {
    await $fetch(`/api/access-requests/${request.id}/deny`, {
        method: 'POST',
        body: { reason: 'Not approved by administrator.' },
    });
    await load();
}
onMounted(load);
</script>

<template>
    <section class="page-section">
        <div class="section-heading">
            <div>
                <p class="eyebrow">Admin queue</p>
                <h1>Signup requests</h1>
                <p class="muted-copy">Review people asking for access to the partner portal.</p>
            </div>
        </div>
        <p
            v-if="message"
            class="success-copy"
        >
            {{ message }}
        </p>
        <div class="panel table-panel">
            <div
                v-if="!requests.length"
                class="empty-state"
            >
                No pending signup requests.
            </div>
            <div
                v-for="request in requests"
                :key="request.id"
                class="list-row"
            >
                <div>
                    <strong>{{ request.name }}</strong
                    ><span>{{ request.email }} · {{ request.localAgencyName || request.staffId }}</span
                    ><small>{{ request.note }}</small>
                </div>
                <StatusBadge :status="request.status === 'pending' ? 'in_progress' : request.status" />
                <div
                    v-if="request.status === 'pending'"
                    class="row-actions"
                >
                    <button
                        class="button button-primary"
                        @click="approve(request)"
                    >
                        Approve</button
                    ><button
                        class="button button-secondary"
                        @click="deny(request)"
                    >
                        Deny
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>
