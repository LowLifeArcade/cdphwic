<script setup lang="ts">
import type { SessionUser } from '~/../shared/domain';
import type { DemoIdentity } from '~/../shared/demoIdentity';
import { getNavigationItems } from '~/../shared/navigation';

const props = defineProps<{ user: SessionUser }>();
const navigation = computed(() => getNavigationItems(props.user));
const mobileOpen = useState('mobile-nav-open', () => false);
const identity = useState<DemoIdentity>('demo-identity', () => 'admin');
const adminSession = useState('admin-session', () => true);
const profileMenuOpen = ref(false);
const loginAsOpen = ref(false);
const loginAsEmail = ref('');
const loginAsError = ref('');

function closeMobileNav() {
    mobileOpen.value = false;
}

function handleDocumentClick(event: MouseEvent) {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest('.sidebar-footer')) {
        profileMenuOpen.value = false;
    }
}

onMounted(() => document.addEventListener('click', handleDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick));

function logout() {
    profileMenuOpen.value = false;
    adminSession.value = false;
    identity.value = 'admin';
    navigateTo('/');
}

function returnToAdmin() {
    identity.value = 'admin';
    profileMenuOpen.value = false;
}

async function loginAs() {
    loginAsError.value = '';
    try {
        const result = await $fetch<{ identity: DemoIdentity }>('/api/auth/impersonate', {
            method: 'POST',
            headers: { 'x-demo-user': 'admin' },
            body: { email: loginAsEmail.value },
        });
        identity.value = result.identity;
        adminSession.value = true;
        loginAsOpen.value = false;
        profileMenuOpen.value = false;
        loginAsEmail.value = '';
    } catch (error) {
        loginAsError.value =
            (error as { statusMessage?: string }).statusMessage ?? 'No demo user was found for that email.';
    }
}
</script>

<template>
    <button
        v-if="mobileOpen"
        class="mobile-nav-overlay"
        aria-label="Close navigation"
        @click="closeMobileNav"
    />
    <aside
        class="sidebar"
        :class="{ 'is-open': mobileOpen }"
    >
        <button
            class="mobile-close"
            aria-label="Close navigation"
            @click="closeMobileNav"
        >
            ×
        </button>
        <NuxtLink
            class="brand"
            to="/summary"
        >
            <span class="brand-mark">✦</span>
            <span>CDPHWIC</span>
        </NuxtLink>

        <div class="sidebar-label">Workspace</div>
        <nav
            class="sidebar-nav"
            aria-label="Main navigation"
        >
            <template
                v-for="item in navigation"
                :key="item.label"
            >
                <NuxtLink
                    class="nav-item"
                    :to="item.to"
                    @click="closeMobileNav"
                >
                    <span class="nav-icon">{{ item.icon }}</span>
                    <span>{{ item.label }}</span>
                </NuxtLink>
                <NuxtLink
                    v-for="child in item.children"
                    :key="child.label"
                    class="nav-child"
                    :to="child.to"
                    @click="closeMobileNav"
                >
                    <span>{{ child.icon }}</span>
                    <span>{{ child.label }}</span>
                </NuxtLink>
            </template>
        </nav>

        <div class="sidebar-footer">
            <NuxtLink
                class="avatar"
                to="/profile"
                aria-label="View profile"
            >
                {{ props.user.name.slice(0, 1) }}
            </NuxtLink>
            <div class="user-mini">
                <strong>{{ props.user.name }}</strong>
                <span>{{
                    props.user.role === 'admin'
                        ? 'Administrator'
                        : props.user.memberType === 'agency'
                          ? 'Agency Rep'
                          : 'FPU Analyst'
                }}</span>
            </div>
            <button
                class="icon-button"
                aria-label="Open profile menu"
                @click="profileMenuOpen = !profileMenuOpen"
            >
                ⋯
            </button>
            <div
                v-if="profileMenuOpen"
                class="profile-menu"
            >
                <NuxtLink
                    to="/profile"
                    @click="profileMenuOpen = false"
                    >View profile</NuxtLink
                >
                <button
                    v-if="adminSession && identity !== 'admin'"
                    type="button"
                    @click="returnToAdmin"
                >
                    Return to admin
                </button>
                <button
                    v-if="adminSession"
                    type="button"
                    @click="loginAsOpen = true"
                >
                    Log in as…
                </button>
                <button
                    type="button"
                    @click="logout"
                >
                    Log out
                </button>
            </div>
        </div>
    </aside>
    <div
        v-if="loginAsOpen"
        class="impersonation-backdrop"
        @click.self="loginAsOpen = false"
    >
        <form
            class="panel impersonation-panel"
            @submit.prevent="loginAs"
        >
            <p class="eyebrow">Admin access</p>
            <h2>Log in as another user</h2>
            <p class="muted-copy">Enter a seeded user email to experience their dashboard without a password.</p>
            <div class="form-field">
                <label>User email</label
                ><input
                    v-model="loginAsEmail"
                    class="form-input"
                    type="email"
                    placeholder="maria@mendocino.example"
                    required
                />
            </div>
            <p
                v-if="loginAsError"
                class="form-error"
            >
                {{ loginAsError }}
            </p>
            <div class="form-actions">
                <button
                    class="button button-secondary"
                    type="button"
                    @click="loginAsOpen = false"
                >
                    Cancel</button
                ><button
                    class="button button-primary"
                    type="submit"
                >
                    Log in as user
                </button>
            </div>
        </form>
    </div>
</template>
