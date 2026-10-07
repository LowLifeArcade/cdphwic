<script setup lang="ts">
const route = useRoute();
const scope = computed(() => (route.query.scope === 'mine' ? 'mine' : 'all'));
const agencyId = ref('');
const repId = ref('');
const { data, refresh } = await useFetch('/api/requests', {
    query: computed(() => ({
        scope: scope.value,
        agencyId: agencyId.value || undefined,
        repId: repId.value || undefined,
    })),
});
const requests = computed(() => data.value?.requests ?? []);
watch([agencyId, repId], () => refresh());
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
            <option value="10">Mendocino County</option>
            <option value="11">Lake County</option>
            <option value="12">Sonoma County</option></select
        ><select
            v-model="repId"
            class="filter-select"
        >
            <option value="">All reps</option>
            <option value="100">Maria Lopez</option>
            <option value="101">David Chen</option>
            <option value="102">Alicia Rivera</option></select
        ><span class="muted-copy">{{ requests.length }} requests</span>
    </div>
    <RequestList :requests="requests" />
</template>
