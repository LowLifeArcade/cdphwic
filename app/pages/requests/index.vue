<script setup lang="ts">
useHead({bodyAttrs:{class:'requests-brand-page'}});
import type { ProductRecord } from '~/../shared/domain';
const route = useRoute();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const scope = computed(() => (route.query.scope === 'mine' ? 'mine' : 'all'));
const agencyId = ref('');
const repId = ref('');
const { data: agencyData } = await useFetch('/api/agencies');
const { data: productData } = await useFetch('/api/products');
const { data, error, status, refresh } = await useFetch('/api/requests', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    query: computed(() => ({
        scope: scope.value,
        agencyId: agencyId.value || undefined,
        repId: repId.value || undefined,
    })),
});
const requests = computed(() => data.value?.requests ?? []);
const products = computed<ProductRecord[]>(() => productData.value?.products ?? []);
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
        ><span v-if="!error" class="muted-copy">{{ requests.length }} requests</span>
    </div>
    <div v-if="error" class="requests-load-error" role="alert">
        <p>Requests could not be loaded. This does not mean they were deleted. Please try again.</p>
        <button class="button button-secondary" type="button" :disabled="status === 'pending'" @click="refresh()">Retry</button>
    </div>
    <p v-else-if="status === 'pending' && !data" role="status">Loading requests…</p>
    <RequestList v-else :requests="requests" :products="products" />
</template>

<style scoped>
.requests-load-error { padding: 20px; border: 1px solid var(--red); border-radius: 8px; background: var(--surface); }
.requests-load-error p { margin-top: 0; }
</style>
