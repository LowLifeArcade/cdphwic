<script setup lang="ts">
definePageMeta({ layout: false });

const router = useRouter();
const form = reactive({ email: '', password: '' });
const error = ref('');
async function login() {
    error.value = '';
    try {
        await $fetch('/api/auth/login', { method: 'POST', body: form });
        await router.push('/summary');
    } catch (err) {
        error.value =
            (err as { data?: { message?: string }; statusMessage?: string }).data?.message ?? 'Unable to sign in.';
    }
}
</script>

<template>
    <div class="auth-page">
        <div class="brand auth-brand"><span class="brand-mark">✦</span><span>CDPHWIC</span></div>
        <form
            class="panel auth-card"
            @submit.prevent="login"
        >
            <p class="eyebrow">Secure partner access</p>
            <h1>Sign in</h1>
            <p class="muted-copy">Use your CDPHWIC email and password to continue.</p>
            <p
                v-if="error"
                class="form-error"
            >
                {{ error }}
            </p>
            <div class="form-grid">
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
                    <label>Password</label
                    ><input
                        v-model="form.password"
                        class="form-input"
                        type="password"
                        required
                    />
                </div>
            </div>
            <button
                class="button button-primary"
                type="submit"
            >
                Sign in
            </button>
            <NuxtLink
                class="auth-link"
                to="/request-access"
                >Need access? Request an invitation</NuxtLink
            >
        </form>
    </div>
</template>
