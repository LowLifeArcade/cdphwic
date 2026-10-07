<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const token = String(route.params.token);
const phase = ref<'verify' | 'signup'>('verify');
const invitation = ref<{
    maskedEmail: string;
    invitationType: 'agency_rep' | 'staff';
    agency?: { id: number; name: string; county: string; shippingAddress: string };
}>();
const code = ref('');
const developmentCode = ref('');
const signupSessionToken = ref('');
const error = ref('');
const complete = ref(false);
const form = reactive({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    agencyName: '',
    county: '',
    shippingAddress: '',
    agencyId: undefined as number | undefined,
    handledAgencyIds: [] as number[],
});
onMounted(async () => {
    try {
        const result = await $fetch<{ invitation: typeof invitation.value }>(`/api/signup-tokens/${token}`);
        invitation.value = result.invitation;
        form.email = result.invitation?.maskedEmail ?? '';
        if (result.invitation?.agency) {
            form.agencyId = result.invitation.agency.id;
            form.agencyName = result.invitation.agency.name;
            form.county = result.invitation.agency.county;
            form.shippingAddress = result.invitation.agency.shippingAddress;
        }
    } catch (err) {
        error.value = (err as { statusMessage?: string }).statusMessage ?? 'This invitation is invalid.';
    }
});
async function sendCode() {
    try {
        const result = await $fetch<{ developmentCode?: string }>(`/api/signup-tokens/${token}/verify/start`, {
            method: 'POST',
        });
        developmentCode.value = result.developmentCode ?? '';
    } catch (err) {
        error.value = (err as { statusMessage?: string }).statusMessage ?? 'Unable to send code.';
    }
}
async function verify() {
    try {
        const result = await $fetch<{ signupSessionToken: string }>(`/api/signup-tokens/${token}/verify/complete`, {
            method: 'POST',
            body: { code: code.value },
        });
        signupSessionToken.value = result.signupSessionToken;
        phase.value = 'signup';
    } catch (err) {
        error.value = (err as { statusMessage?: string }).statusMessage ?? 'That code is not valid.';
    }
}
async function finish() {
    try {
        await $fetch(`/api/signup-tokens/${token}/complete`, {
            method: 'POST',
            body: { ...form, signupSessionToken: signupSessionToken.value, email: undefined },
        });
        complete.value = true;
    } catch (err) {
        error.value = (err as { statusMessage?: string }).statusMessage ?? 'Unable to complete signup.';
    }
}
</script>

<template>
    <div class="auth-page">
        <div class="brand auth-brand"><span class="brand-mark">✦</span><span>CDPHWIC</span></div>
        <div class="panel auth-card">
            <template v-if="complete"
                ><p class="eyebrow">All set</p>
                <h1>Signup complete</h1>
                <p class="muted-copy">Your account is ready. An administrator can confirm access details.</p>
                <NuxtLink
                    class="button button-primary"
                    to="/"
                    >Return to sign in</NuxtLink
                ></template
            >
            <template v-else-if="phase === 'verify'"
                ><p class="eyebrow">Private invitation</p>
                <h1>Verify your email</h1>
                <p class="muted-copy">
                    This invitation was issued for <strong>{{ invitation?.maskedEmail || 'your invited email' }}</strong
                    >.
                </p>
                <p
                    v-if="error"
                    class="form-error"
                >
                    {{ error }}
                </p>
                <button
                    class="button button-primary"
                    type="button"
                    @click="sendCode"
                >
                    Email me a verification code
                </button>
                <div
                    v-if="developmentCode"
                    class="notice"
                >
                    Development code: <strong>{{ developmentCode }}</strong>
                </div>
                <div
                    v-if="developmentCode"
                    class="form-field"
                >
                    <label>Verification code</label
                    ><input
                        v-model="code"
                        class="form-input"
                        inputmode="numeric"
                        maxlength="6"
                    /><button
                        class="button button-primary"
                        type="button"
                        @click="verify"
                    >
                        Verify email
                    </button>
                </div></template
            >
            <template v-else
                ><p class="eyebrow">
                    {{ invitation?.invitationType === 'agency_rep' ? 'Local agency rep' : 'FPU staff' }} signup
                </p>
                <h1>Finish your profile</h1>
                <p
                    v-if="error"
                    class="form-error"
                >
                    {{ error }}
                </p>
                <div class="form-grid">
                    <div class="form-field">
                        <label>First name</label
                        ><input
                            v-model="form.firstName"
                            class="form-input"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label>Last name</label
                        ><input
                            v-model="form.lastName"
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
                    <div class="form-field full">
                        <label>Phone</label
                        ><input
                            v-model="form.phone"
                            class="form-input"
                        />
                    </div>
                    <template v-if="invitation?.invitationType === 'agency_rep'"
                        ><div class="form-field">
                            <label>Local agency</label
                            ><input
                                v-model="form.agencyName"
                                class="form-input"
                            />
                        </div>
                        <div class="form-field">
                            <label>County</label
                            ><input
                                v-model="form.county"
                                class="form-input"
                            />
                        </div>
                        <div class="form-field full">
                            <label>Shipping address</label
                            ><input
                                v-model="form.shippingAddress"
                                class="form-input"
                            /></div
                    ></template>
                    <div
                        v-else
                        class="form-field full"
                    >
                        <label>Handled agencies</label
                        ><input
                            class="form-input"
                            placeholder="Agency IDs, comma separated"
                        />
                    </div>
                </div>
                <button
                    class="button button-primary"
                    type="button"
                    @click="finish"
                >
                    Create account
                </button></template
            >
        </div>
    </div>
</template>
