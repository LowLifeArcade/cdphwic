<script setup lang="ts">
import type { DemoIdentity } from '~/../shared/demoIdentity';
const router = useRouter();
const identity = useState<DemoIdentity>('demo-identity', () => 'agency');
const email = ref('');
async function login() {
    await router.push('/summary');
}
</script>

<template>
    <div class="auth-page">
        <div class="brand auth-brand"><span class="brand-mark">✦</span><span>CDPHWIC</span></div>
        <form
            class="panel auth-card"
            @submit.prevent="login"
        >
            <p class="eyebrow">Welcome back</p>
            <h1>Sign in</h1>
            <p class="muted-copy">Use a demo identity to explore the dashboard.</p>
            <div class="form-grid">
                <div class="form-field full">
                    <label>Email</label
                    ><input
                        v-model="email"
                        class="form-input"
                        type="email"
                        placeholder="you@example.com"
                        required
                    />
                </div>
                <div class="form-field full">
                    <label>Password</label
                    ><input
                        class="form-input"
                        type="password"
                        placeholder="Development stub"
                        required
                    />
                </div>
                <div class="form-field full">
                    <label>Demo role</label
                    ><select
                        v-model="identity"
                        class="form-input"
                    >
                        <option value="agency">Agency member</option>
                        <option value="internal">FPU analyst</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
            </div>
            <button
                class="button button-primary"
                type="submit"
            >
                Sign in</button
            ><NuxtLink
                class="auth-link"
                to="/auth/signup"
                >Need an account? Sign up</NuxtLink
            >
        </form>
    </div>
</template>
