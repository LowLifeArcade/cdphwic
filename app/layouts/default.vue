<script setup lang="ts">
import type { SessionUser } from '~/../shared/domain';
import { DEMO_USER_LABELS, type DemoIdentity } from '~/../shared/demoIdentity';

const identity = useState<DemoIdentity>('demo-identity', () => 'admin');
const demoUser = computed<SessionUser>(() => {
    const profile = DEMO_USER_LABELS[identity.value];
    return profile.memberType === 'agency'
        ? {
              id: 2,
              name: profile.name,
              role: profile.role,
              memberType: profile.memberType,
              agencyId: 10,
              agencyMemberId: 100,
          }
        : identity.value === 'internal'
          ? {
                id: 3,
                name: profile.name,
                role: profile.role,
                memberType: profile.memberType,
                internalMemberId: 200,
                handledAgencyIds: [10, 11],
                handledRepIds: [100, 101],
            }
          : { id: 1, name: profile.name, role: profile.role, memberType: profile.memberType, internalMemberId: 200 };
});
</script>

<template>
    <div class="app-shell">
        <AppSidebar :user="demoUser" />
        <div class="app-main">
            <AppTopbar />
            <main class="page-content"><slot /></main>
        </div>
    </div>
</template>
