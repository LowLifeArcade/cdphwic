<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import type {RequestRecord} from '~/../shared/domain';
import type {FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {remainingSupplyOrder} from '~/../shared/issuanceSupply';
const props=defineProps<{request:Partial<RequestRecord>;authorization:FormulaAuthorization;unitsPerCase?:number;publishedShipments?:RequestRecord['shipments']}>();
const plan=computed(()=>remainingSupplyOrder(props.request,props.authorization,props.unitsPerCase??props.authorization.unitsPerCase,props.publishedShipments));
const sourceRows=computed(()=>plan.value.supply.rows.filter(row=>row.kind!=='surplus'));
const surplusRows=computed(()=>[{key:'planned-surplus',kind:'surplus' as const,label:'Expected Surplus',units:plan.value.surplus}]);
</script>
<template>
    <section class="supply-plan" aria-label="Live supply calculation">
        <h4>Supply Plan</h4>
        <p class="approved-total">{{plan.supply.total}} {{unitLabel(plan.supply.total)}} Approved</p>
        <RequestSupplySources :rows="sourceRows" />
        <div class="order-recommendation" aria-label="Recommended order" aria-live="polite">
            <h5>Recommended Order</h5>
            <template v-if="plan.orderUnits!==undefined">
                <p v-if="plan.needed">{{plan.needed}} {{unitLabel(plan.needed)}} to cover from distributor orders.</p>
                <strong v-if="plan.cases">{{plan.cases}} {{plan.cases===1?'Case':'Cases'}} × {{plan.unitsPerCase}} {{unitLabel(plan.unitsPerCase)}} = {{plan.orderUnits}} {{unitLabel(plan.orderUnits)}}</strong>
                <strong v-else>No additional order needed.</strong>
            </template>
            <p v-else>Confirm Units Per Case for this formula and its shipments to calculate the recommended order.</p>
        </div>
        <p v-if="plan.supply.plannedUnits" class="draft-coverage">In distributor drafts: <strong>{{plan.supply.plannedUnits}} {{unitLabel(plan.supply.plannedUnits)}}</strong>.<template v-if="plan.stillToPlan===0"> Drafts cover the recommendation. Review and send ETA in Shipping.</template><template v-else-if="plan.stillToPlan!==undefined"> Still to plan: {{plan.stillToPlan}} {{unitLabel(plan.stillToPlan)}}.</template></p>
        <p v-if="plan.supply.unknownPlannedUnits" class="muted-copy">A distributor draft needs Units Per Case before its planned quantity can be calculated.</p>
        <RequestSupplySources :rows="surplusRows" />
        <p v-if="plan.needed&&plan.surplus!==undefined" class="muted-copy">Expected surplus includes the recommended whole-case order.</p>
        <p v-if="sourceRows.some(row=>row.kind==='transfer'&&row.pending)" class="muted-copy">Selected transfer quantities are included above. Reserve Stock in Issuance to confirm the allocations.</p>
        <p v-if="plan.supply.local>plan.supply.total" class="plan-warning" role="status">On Hand allocations exceed the approved total. Review the assigned quantities.</p>
    </section>
</template>
<style scoped>
.supply-plan {margin-top:18px;padding:16px;border:2px solid light-dark(#002595,#75baff);border-radius:10px;background:var(--surface);}
.supply-plan h4 {margin:0 0 4px;font-size:1rem;}
.supply-plan .approved-total {margin:0 0 10px;color:light-dark(#002595,#75baff);font-size:1.15rem;font-weight:700;line-height:1.35;}
.order-recommendation {margin:12px 0 6px;padding:12px;border-radius:6px;background:light-dark(#eef3ff,#172c46);}
.order-recommendation h5 {margin:0 0 6px;font-size:.95rem;}
.order-recommendation p {margin:0 0 8px;font-size:.875rem;}
.order-recommendation strong {display:block;color:light-dark(#002595,#75baff);}
.supply-plan .muted-copy,.plan-warning,.draft-coverage {margin:8px 0 0;font-size:.875rem;}
.plan-warning {color:light-dark(#8a4200,#ffc789);}
</style>
