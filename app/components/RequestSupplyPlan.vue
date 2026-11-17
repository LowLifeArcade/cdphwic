<script setup lang="ts">
import type {RequestRecord} from '~/../shared/domain';
import type {FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {issuanceSupplyPlan} from '~/../shared/issuanceSupply';
const props=defineProps<{request:Partial<RequestRecord>;authorization:FormulaAuthorization;unitsPerCase?:number}>();
const plan=computed(()=>issuanceSupplyPlan(props.request,props.authorization,props.unitsPerCase));
</script>

<template>
    <section class="supply-plan" aria-label="Live supply calculation">
        <h4>Supply plan</h4>
        <dl class="plan-equation">
            <div><dt><span class="plan-sign" aria-hidden="true"></span>Total Unit(s) Approved</dt><dd>{{plan.total}} unit(s)</dd></div>
            <div><dt><span class="plan-sign" aria-hidden="true">−</span>Assigned Local Agency Surplus</dt><dd>{{plan.local}} unit(s)</dd></div>
            <div><dt><span class="plan-sign" aria-hidden="true">−</span>Allocated Transfers</dt><dd>{{plan.transferred}} unit(s)</dd></div>
            <div class="plan-result"><dt><span class="plan-sign" aria-hidden="true">=</span>Unit(s) Still Needed from Orders</dt><dd>{{plan.needed}} unit(s)</dd></div>
        </dl>
        <div class="order-recommendation">
            <span>Recommended Order</span>
            <strong v-if="plan.orderedUnits!==undefined">{{plan.cases}} case(s)<template v-if="plan.cases"> × {{plan.unitsPerCase}} unit(s)</template> = {{plan.orderedUnits}} unit(s)</strong>
            <strong v-else>Enter Units Per Case to calculate the order.</strong>
        </div>
        <div class="plan-surplus"><span>Expected Surplus</span><strong>{{plan.surplus===undefined?'—':`${plan.surplus} unit(s)`}}</strong></div>
        <p v-if="plan.surplus" class="muted-copy">{{plan.total}} unit(s) are approved. The remaining {{plan.surplus}} unit(s) from the planned supply are expected surplus.</p>
        <p v-if="plan.local+plan.transferred>plan.total" class="plan-warning" role="status">Surplus and transfer allocations exceed the approved total. Review the assigned quantities before ordering.</p>
        <p v-if="plan.unknownTransferSize" class="plan-warning" role="status">A transfer needs Units Per Case before its quantity can be included.</p>
        <p class="muted-copy">Updates as you edit. Use the recommendation to plan distributor shipments in Shipping.</p>
    </section>
</template>

<style scoped>
.supply-plan {margin-top:18px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--surface);}
.supply-plan h4 {margin:0 0 12px;font-size:1rem;}
.plan-equation {margin:0;}
.plan-equation>div,.plan-surplus {display:flex;justify-content:space-between;gap:16px;padding:8px 0;}
.plan-equation dt {display:flex;align-items:baseline;}
.plan-equation dd {margin:0;font-weight:600;text-align:right;white-space:nowrap;}
.plan-sign {flex:0 0 22px;font-weight:700;}
.plan-equation .plan-result {border-top:2px solid var(--line);margin-top:6px;padding-top:14px;font-weight:700;color:light-dark(#002595,#75baff);}
.order-recommendation {display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;padding:12px;border-radius:6px;background:light-dark(#eef3ff,#172c46);}
.plan-surplus {padding:12px;}
.supply-plan p {margin:8px 0 0;font-size:.875rem;}
.plan-warning {color:light-dark(#8a4200,#ffc789);}
@media(max-width:540px){.plan-equation>div{flex-direction:column;gap:4px;}.plan-equation dd{text-align:left;padding-left:22px;}}
</style>
