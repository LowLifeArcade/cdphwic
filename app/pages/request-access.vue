<script setup lang="ts">
definePageMeta({ layout: false });

const router = useRouter();
const form = reactive({
    name: '',
    email: '',
    localAgencyName: '',
    staffId: '',
    requestedMemberType: 'agency',
    note: '',
});
const message = ref('');
const error = ref('');
async function submit() {
    error.value = '';
    try {
        await $fetch('/api/access-requests', { method: 'POST', body: form });
        message.value = 'Your request was sent to the CDPHWIC admins.';
    } catch (err) {
        error.value = (err as { statusMessage?: string }).statusMessage ?? 'Please check the form and try again.';
    }
}
</script>

<template>
    <div class="auth-page">
        <div class="brand auth-brand"><span class="brand-mark">✦</span><span>CDPHWIC</span></div>
        <form
            class="panel auth-card"
            @submit.prevent="submit"
        >
            <p class="eyebrow">Request access</p>
            <h1>Ask for an invitation</h1>
            <p class="muted-copy">An administrator will review your request and email you a private signup link.</p>
            <p
                v-if="message"
                class="success-copy"
            >
                {{ message }}
            </p>
            <p
                v-if="error"
                class="form-error"
            >
                {{ error }}
            </p>
            <div class="form-grid">
                <div class="form-field full">
                    <label>Name</label
                    ><input
                        v-model="form.name"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field full">
                    <label>Email</label
                    ><input
                        v-model="form.email"
                        class="form-input"
                        type="email"
                        required
                    />
                </div>
                <div class="form-field">
                    <label>Access type</label
                    ><select
                        v-model="form.requestedMemberType"
                        class="form-input"
                    >
                        <option value="agency">Local agency rep</option>
                        <option value="internal">FPU staff</option>
                    </select>
                </div>
                <div class="form-field">
                    <label v-if="form.requestedMemberType === 'agency'">Local agency name</label>
                    <label v-else>Staff ID</label>
                    <input
                        v-if="form.requestedMemberType === 'agency'"
                        v-model="form.localAgencyName"
                        class="form-input"
                        required
                    />
                    <input
                        v-else
                        v-model="form.staffId"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field full">
                    <label>Why do you need access?</label
                    ><textarea
                        v-model="form.note"
                        class="form-input"
                        rows="4"
                        required
                    />
                </div>
            </div>
            <button
                class="button button-primary"
                type="submit"
            >
                Submit request</button
            ><NuxtLink
                class="auth-link"
                to="/"
                >Back to sign in</NuxtLink
            >
        </form>
    </div>
</template>
