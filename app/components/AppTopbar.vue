<script setup lang="ts">
import type { DemoIdentity } from '~/../shared/demoIdentity';

const identity = useState<DemoIdentity>('demo-identity', () => 'admin');
const mobileOpen = useState('mobile-nav-open', () => false);
const search = ref('');

function switchIdentity(value: DemoIdentity) {
    identity.value = value;
}

function toggleMobileNav() {
    mobileOpen.value = !mobileOpen.value;
}
</script>

<template>
    <header class="topbar">
        <button
            class="mobile-menu-button icon-button"
            aria-label="Open navigation"
            @click="toggleMobileNav"
        >
            ☰
        </button>
        <div class="search-box">
            <span>⌕</span>
            <input
                v-model="search"
                aria-label="Search"
                placeholder="Search requests, participants, agencies..."
            />
        </div>
        <div class="topbar-actions">
            <label class="demo-switcher">
                <span>View as</span>
                <select
                    :value="identity"
                    aria-label="View as"
                    @change="switchIdentity(($event.target as HTMLSelectElement).value as DemoIdentity)"
                >
                    <option value="admin">Admin</option>
                    <option value="agency">Agency rep</option>
                    <option value="internal">FPU analyst</option>
                </select>
            </label>
            <button
                class="icon-button"
                aria-label="Notifications"
            >
                ⍾
            </button>
            <NuxtLink
                class="button button-primary"
                to="/requests/new"
                >＋ New Request</NuxtLink
            >
        </div>
    </header>
</template>
