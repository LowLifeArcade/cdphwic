<script setup lang="ts">
const router = useRouter();
const form = reactive({ name: '', email: '', memberType: 'agency', agency: '', preferredAnalyst: '' });
async function signup() {
    await $fetch('/api/auth/signup', {
        method: 'POST',
        body: { name: form.name, email: form.email, role: 'member', memberType: form.memberType },
    });
    await router.push('/auth/login');
}
</script>

<template>
    <div class="auth-page">
        <div class="brand auth-brand"><span class="brand-mark">✦</span><span>CDPHWIC</span></div>
        <form
            class="panel auth-card"
            @submit.prevent="signup"
        >
            <p class="eyebrow">Create account</p>
            <h1>Sign up</h1>
            <p class="muted-copy">Set your member type now; profile assignments can be updated later.</p>
            <div class="form-grid">
                <div class="form-field full">
                    <label>Full name</label
                    ><input
                        v-model="form.name"
                        class="form-input"
                        placeholder="First and last name"
                        required
                    />
                </div>
                <div class="form-field full">
                    <label>Email</label
                    ><input
                        v-model="form.email"
                        class="form-input"
                        type="email"
                        placeholder="you@example.com"
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
                        <option value="internal">FPU / internal staff</option>
                    </select>
                </div>
                <div class="form-field">
                    <label>{{ form.memberType === 'agency' ? 'Local agency' : 'Handled agencies' }}</label
                    ><input
                        v-model="form.agency"
                        class="form-input"
                        placeholder="Optional for now"
                    />
                </div>
                <div class="form-field full">
                    <label>Preferred analyst / assignment notes</label
                    ><input
                        v-model="form.preferredAnalyst"
                        class="form-input"
                        placeholder="Optional generic assignment field"
                    />
                </div>
            </div>
            <button
                class="button button-primary"
                type="submit"
            >
                Create account</button
            ><NuxtLink
                class="auth-link"
                to="/auth/login"
                >Already have an account? Sign in</NuxtLink
            >
        </form>
    </div>
</template>
