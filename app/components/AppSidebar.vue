<script setup lang="ts">
import type { SessionUser } from '~/../shared/domain';
import { getNavigationItems } from '~/../shared/navigation';

const props = defineProps<{ user: SessionUser }>();
const navigation = computed(() => getNavigationItems(props.user));
const mobileOpen = useState('mobile-nav-open', () => false);

function closeMobileNav() {
    mobileOpen.value = false;
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
            <div class="avatar">{{ props.user.name.slice(0, 1) }}</div>
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
            <NuxtLink
                class="icon-button"
                to="/profile"
                aria-label="Profile"
                >⋯</NuxtLink
            >
        </div>
    </aside>
</template>
