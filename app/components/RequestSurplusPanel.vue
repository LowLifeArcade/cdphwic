<script setup lang="ts">
import {formatDisplayDate,formulaFormLabel} from '~/../shared/requestPresentation';
import type { RequestRecord } from '~/../shared/domain';
import {surplusShipmentDraft} from '~/../shared/requestTransfers';
import { availableUnits, isReviewer } from '~/../shared/surplus';
const props = defineProps<{ request: RequestRecord }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const { data, error } = await useFetch('/api/surplus', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    server: false,
});
const names = computed(() =>
    [
        props.request.productName,
        ...(props.request.requestedFormulas ?? []).map((f) => f.otherFormulaName || f.productName),
    ].map((n) => n.trim().toLowerCase()),
);
const lots = computed(
    () => data.value?.lots.filter((l: any) => names.value.includes(l.formulaName.toLowerCase())) ?? [],
);
const reference = computed(() => props.request.submissionId ?? `request-${props.request.id}`);
const movements = computed(() => data.value?.movements.filter((m: any) => m.request_ref === reference.value) ?? []);
const transfers = computed(() => data.value?.transfers.filter((t: any) => t.request_ref === reference.value) ?? []);
</script>
<template>
    <section class="detail-section">
        <h3>Agency surplus tracker</h3>
        <p v-if="error">Inventory is temporarily unavailable.</p>
        <div
            v-for="lot in lots"
            :key="lot.id"
            class="request-lot"
        >
            <strong>{{ lot.formulaName }}</strong> · {{ formulaFormLabel(lot.form) }} {{ lot.flavor }}
            <p>
                Agency {{ lot.agencyId }} · Expires {{ formatDisplayDate(lot.expirationDate) }}<br />Usable {{ lot.onHand }} · Reserved
                {{ lot.reserved }} · Available {{ availableUnits(lot as any) }} · Expired {{ lot.expiredUnits }}
            </p>
            <NuxtLink
                class="button"
                :to="{
                    path: data?.user && isReviewer(data.user) && surplusShipmentDraft(request,lot,[]) ? '/requests' : '/surplus',
                    query: data?.user && isReviewer(data.user) && surplusShipmentDraft(request,lot,[]) ? {request:request.id,surplusLot:lot.id} : {formula:lot.formulaName,agency:lot.agencyId},
                    hash: data?.user && isReviewer(data.user) && surplusShipmentDraft(request,lot,[]) ? `#shipments-${request.id}` : undefined,
                }"
                >{{ data?.user && isReviewer(data.user) && surplusShipmentDraft(request,lot,[]) ? 'Use in Shipment' : 'View inventory' }}</NuxtLink
            >
        </div>
        <p v-if="!lots.length && !error">No verified matching stock.</p>
        <p
            v-for="m in movements"
            :key="m.id"
        >
            {{ m.kind }} · {{ m.quantity }} unit(s) · {{ m.formula_name }} · Agency {{ m.agency_id }} · {{ m.created_at }}
        </p>
        <p
            v-for="t in transfers"
            :key="t.id"
        >
            Transfer {{ t.quantity }} unit(s) · {{ t.formula_name }} · Agency {{ t.source_agency_id }} →
            {{ t.destination_agency_id }} · {{ t.status }}
        </p>
        <NuxtLink
            class="button"
            :to="{ path: '/surplus', query: { formula: request.productName, request: reference } }"
            >Open formula surplus</NuxtLink
        >
    </section>
</template>
<style scoped>
.request-lot {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
}
p {
    color: var(--muted);
}
</style>
