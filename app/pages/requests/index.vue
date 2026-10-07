<script setup lang="ts">
const route = useRoute();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const scope = computed(() => (route.query.scope === 'mine' ? 'mine' : 'all'));
const agencyId = ref('');
const repId = ref('');
const { data: agencyData } = await useFetch('/api/agencies');
const { data, refresh } = await useFetch('/api/requests', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    query: computed(() => ({
        scope: scope.value,
        agencyId: agencyId.value || undefined,
        repId: repId.value || undefined,
    })),
});
const requests = computed(() => data.value?.requests ?? []);
const currentUser = computed(() => data.value?.user);
const availableAgencies = computed(() => {
    const all = agencyData.value?.agencies ?? [];
    if (currentUser.value?.role === 'admin') {
        return all;
    }

    if (currentUser.value?.memberType === 'agency' && currentUser.value.agencyId) {
        return all.filter((agency) => agency.id === currentUser.value?.agencyId);
    }

    return all.filter((agency) => currentUser.value?.handledAgencyIds?.includes(agency.id));
});
const availableReps = computed(() => {
    const members = agencyData.value?.members ?? [];
    const agencyIds = agencyId.value ? [Number(agencyId.value)] : availableAgencies.value.map((agency) => agency.id);
    return members.filter((member) => agencyIds.includes(member.agencyId));
});
watch([agencyId, repId, identity], () => refresh());
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Operations</p>
            <h1>{{ scope === 'mine' ? 'My Requests' : 'Requests' }}</h1>
            <p>
                {{
                    scope === 'mine'
                        ? 'Requests connected to your agencies and reps.'
                        : 'Review requests, status, dates, and delivery timing.'
                }}
            </p>
        </div>
        <NuxtLink
            class="button button-primary"
            to="/requests/new"
            >＋ New Request</NuxtLink
        >
    </div>
    <div
        class="filter-bar"
        style="margin-bottom: 16px"
    >
        <select
            v-model="agencyId"
            class="filter-select"
        >
            <option value="">All local agencies</option>
            <option
                v-for="agency in availableAgencies"
                :key="agency.id"
                :value="String(agency.id)"
            >
                {{ agency.name }}
            </option></select
        ><select
            v-model="repId"
            class="filter-select"
        >
            <option value="">All reps</option>
            <option
                v-for="member in availableReps"
                :key="member.id"
                :value="String(member.id)"
            >
                {{ member.name }}
            </option></select
        ><span class="muted-copy">{{ requests.length }} requests</span>
    </div>
    <RequestList :requests="requests" />
</template>
