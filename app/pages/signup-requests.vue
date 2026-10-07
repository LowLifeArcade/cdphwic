<script setup lang="ts">
import type { AccessRequest } from '~/../shared/accessFlow';
const requests = ref<AccessRequest[]>([]);
const message = ref('');
const inviteForm = reactive({ email: '', memberType: 'agency', agencyId: '10' });
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
async function sendInvite() {
    const result = await $fetch<{ message: string }>('/api/invitations', {
        method: 'POST',
        body: {
            email: inviteForm.email,
            memberType: inviteForm.memberType,
            ...(inviteForm.memberType === 'agency' ? { agencyId: Number(inviteForm.agencyId) } : {}),
        },
    });
    message.value = result.message;
    inviteForm.email = '';
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
        <div class="section-heading section-heading-spaced">
            <div>
                <p class="eyebrow">Direct invite</p>
                <h2>Send an invitation</h2>
                <p class="muted-copy">
                    Invite someone who has already been approved or is not submitting an access request.
                </p>
            </div>
        </div>
        <form
            class="panel form-panel"
            @submit.prevent="sendInvite"
        >
            <div class="form-grid">
                <div class="form-field full">
                    <label>Email</label
                    ><input
                        v-model="inviteForm.email"
                        class="form-input"
                        type="email"
                        placeholder="member@example.com"
                        required
                    />
                </div>
                <div class="form-field">
                    <label>Member type</label
                    ><select
                        v-model="inviteForm.memberType"
                        class="form-input"
                    >
                        <option value="agency">Local agency rep</option>
                        <option value="internal">Internal FPU staff</option>
                    </select>
                </div>
                <div
                    v-if="inviteForm.memberType === 'agency'"
                    class="form-field"
                >
                    <label>Agency</label
                    ><select
                        v-model="inviteForm.agencyId"
                        class="form-input"
                    >
                        <option value="10">Mendocino County</option>
                        <option value="11">Lake County</option>
                        <option value="12">Sonoma County</option>
                    </select>
                </div>
            </div>
            <div class="form-actions">
                <button
                    class="button button-primary"
                    type="submit"
                >
                    Send invite
                </button>
            </div>
        </form>
    </section>
</template>
