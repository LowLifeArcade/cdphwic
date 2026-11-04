<script setup lang="ts">
import type {ProductRecord,RequestRecord} from '~/../shared/domain';
import {formulaAuthorizations,formatIssuanceMonth,type FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {formulaFormLabel} from '~/../shared/requestPresentation';
const props=defineProps<{request:RequestRecord;products?:ProductRecord[]}>();
const authorizations=computed(()=>formulaAuthorizations(props.request));
function product(row:FormulaAuthorization){return props.products?.find(product=>product.name===row.productName&&product.form===row.productForm);}
</script>

<template>
    <section class="detail-section agency-issuance-summary" aria-label="Issuance details">
        <div class="section-heading"><h3 style="color:light-dark(#002595,#0077CF)">Issuance</h3></div>
        <fieldset v-for="(authorization,index) in authorizations" :key="index" class="authorization-formula">
            <legend v-if="authorizations.length>1">Formula {{index+1}}</legend>
            <div class="detail-grid">
                <div><span>Formula Name</span><strong>{{authorization.productName}}<template v-if="authorization.flavor"> · {{authorization.flavor}}</template><br />{{formulaFormLabel(authorization.productForm)}}</strong></div>
                <div><span>Product Number</span><strong>{{product(authorization)?.productCode ?? '—'}}</strong></div>
                <div><span>Units Per Case</span><strong>{{product(authorization)?.unitsPerCase ?? '—'}}</strong></div>
                <div><span>Yield</span><strong>{{product(authorization)?.yield!==undefined?`${product(authorization)!.yield} fl oz`:'—'}}</strong></div>
                <div><span>Approved Cases</span><strong>{{authorization.approvedCases ?? '—'}}</strong></div>
                <div><span>Approved Months</span><strong>{{authorization.approvedMonths ?? '—'}}</strong></div>
                <div><span>Agency Unit(s) On Hand</span><strong>{{authorization.agencyUnitsOnHand ?? '—'}} {{authorization.agencyUnitsOnHandUnit==='cases'?'Cases':'Unit(s)'}}</strong></div>
                <div><span>Expected Surplus</span><strong>{{authorization.expectedSurplus ?? '—'}} {{authorization.expectedSurplusUnit==='cases'?'Cases':'Unit(s)'}}</strong></div>
            </div>
            <table v-if="authorization.benefitIssuances.some(row=>row.month)" class="issuance-summary-months">
                <thead><tr><th scope="col">Month</th><th scope="col">Quantity</th></tr></thead>
                <tbody><tr v-for="issuance in authorization.benefitIssuances.filter(row=>row.month)" :key="issuance.month"><td>{{formatIssuanceMonth(issuance.month)}}</td><td>{{issuance.quantity}} Unit(s)</td></tr></tbody>
            </table>
            <p v-else class="muted-copy">Issuance months have not been saved yet.</p>
        </fieldset>
        <div class="detail-grid"><div class="detail-field-wide"><span>Next Steps</span><strong class="preserve-lines">{{request.nextSteps || '—'}}</strong></div></div>
    </section>
</template>

<style scoped>
.issuance-summary-months {width:100%;border-collapse:collapse;margin-top:14px;text-align:left;}
.issuance-summary-months th {font-size:var(--form-label-size);font-weight:400;color:var(--muted);padding:0 12px 6px 0;}
.issuance-summary-months td {padding:6px 12px 6px 0;font-size:1rem;font-weight:600;border-top:1px solid var(--line);}
</style>
