<script setup lang="ts">
const form = reactive({ email: '', memberType: 'agency', agencyId: '10' });
const sent = ref(false);
async function invite() {
    await $fetch('/api/invitations', {
        method: 'POST',
        body: {
            email: form.email,
            memberType: form.memberType,
            ...(form.memberType === 'agency' ? { agencyId: Number(form.agencyId) } : {}),
        },
    });
    sent.value = true;
    form.email = '';
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Admin</p>
            <h1>Invite members</h1>
            <p>Invite local agency reps and internal FPU staff.</p>
        </div>
    </div>
    <form
        class="panel form-panel"
        @submit.prevent="invite"
    >
        <div class="form-grid">
            <div class="form-field full">
                <label>Email</label
                ><input
                    v-model="form.email"
                    class="form-input"
                    type="email"
                    placeholder="member@example.com"
                    required
                />
            </div>
            <div class="form-field">
                <label>Member type</label
                ><select
                    v-model="form.memberType"
                    class="form-input"
                >
                    <option value="agency">Local agency member</option>
                    <option value="internal">Internal FPU staff</option>
                </select>
            </div>
            <div
                v-if="form.memberType === 'agency'"
                class="form-field"
            >
                <label>Agency</label
                ><select
                    v-model="form.agencyId"
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
        <p
            v-if="sent"
            class="muted-copy"
        >
            Invitation prepared in development mode.
        </p>
    </form>
</template>
