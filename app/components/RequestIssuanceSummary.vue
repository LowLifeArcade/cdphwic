<script setup lang="ts">
import {authorizationCatalogProduct} from '~/../shared/productMatching';
import {unitLabel} from '~/../shared/quantityLabels';
import type {ProductRecord,RequestRecord} from '~/../shared/domain';
import {formulaAuthorizations,formatIssuanceMonth,type FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {issuanceSupplySources} from '~/../shared/issuanceSupply';
import {formulaFormLabel} from '~/../shared/requestPresentation';
const props=defineProps<{request:RequestRecord;products?:ProductRecord[]}>();
const emit=defineEmits<{recordIssue:[command:{formulaIndex:number;month:string;units:number}]}>();
const authorizations=computed(()=>formulaAuthorizations(props.request));
const supplies=computed(()=>authorizations.value.map(row=>issuanceSupplySources(props.request,row)));
function product(row:FormulaAuthorization){return authorizationCatalogProduct(props.products??[],row);}
function assigned(row:FormulaAuthorization){return (row.localSurplusAllocations??[]).reduce((sum,allocation)=>sum+allocation.units,0);}
function localIssueTarget(row:FormulaAuthorization,month:string){let remaining=assigned(row);for(const issuance of [...row.benefitIssuances].filter(item=>item.month&&item.quantity>0).sort((a,b)=>a.month.localeCompare(b.month))){const target=Math.min(issuance.quantity,remaining);remaining-=target;if(issuance.month===month)return target;}return 0;}
function issuedForMonth(row:FormulaAuthorization,month:string){return row.localSurplusIssued?.find(issue=>issue.month===month)?.units??0;}
function earlierLocalIssuesComplete(row:FormulaAuthorization,month:string){let remaining=assigned(row);for(const issuance of [...row.benefitIssuances].filter(item=>item.month&&item.quantity>0).sort((a,b)=>a.month.localeCompare(b.month))){const target=Math.min(issuance.quantity,remaining);remaining-=target;if(issuance.month===month)return true;if(target>0&&!issuedForMonth(row,issuance.month))return false;}return true;}
</script>

<template>
    <section class="detail-section agency-issuance-summary" aria-label="Issuance details">
        <div class="section-heading"><h3 style="color:light-dark(#002595,#0077CF)">Issuance</h3></div>
        <fieldset v-for="(authorization,index) in authorizations" :key="index" class="authorization-formula">
            <legend v-if="authorizations.length>1">Formula {{index+1}}</legend>
            <div class="detail-grid">
                <div><span>Formula Name</span><strong>{{authorization.formulaName||authorization.productName}}<template v-if="product(authorization)?.flavor || authorization.flavor"> · {{product(authorization)?.flavor || authorization.flavor}}</template></strong></div>
                <div><span>Form</span><strong>{{formulaFormLabel(product(authorization)?.form === 'other' ? authorization.productForm : product(authorization)?.form || authorization.productForm)}}</strong></div>
                <div><span>Product Number</span><strong>{{authorization.productCode||product(authorization)?.productCode||'—'}}</strong></div>
                <div><span>Units Per Case</span><strong>{{authorization.unitsPerCase??product(authorization)?.unitsPerCase??'—'}}</strong></div>
                <div><span>Yield</span><strong>{{(authorization.yield??product(authorization)?.yield)!==undefined?`${authorization.yield??product(authorization)?.yield} fl oz`:'—'}}</strong></div>
            </div>
            <table v-if="authorization.benefitIssuances.some(row=>row.month)" class="issuance-summary-months">
                <thead><tr><th scope="col">Month</th><th scope="col">Approved Quantity</th><th v-if="assigned(authorization)>0" scope="col">Local Surplus Issue</th></tr></thead>
                <tbody><tr v-for="issuance in authorization.benefitIssuances.filter(row=>row.month)" :key="issuance.month"><td>{{formatIssuanceMonth(issuance.month)}}</td><td>{{issuance.quantity}} {{unitLabel(issuance.quantity)}}</td><td v-if="assigned(authorization)"><template v-if="issuedForMonth(authorization,issuance.month)">{{issuedForMonth(authorization,issuance.month)}} {{unitLabel(issuedForMonth(authorization,issuance.month))}} recorded</template><button v-else-if="localIssueTarget(authorization,issuance.month)>0" class="button button-secondary" type="button" :disabled="!earlierLocalIssuesComplete(authorization,issuance.month)" @click="emit('recordIssue',{formulaIndex:index,month:issuance.month,units:localIssueTarget(authorization,issuance.month)})">Confirm {{localIssueTarget(authorization,issuance.month)}} {{unitLabel(localIssueTarget(authorization,issuance.month))}} issued</button><template v-else>—</template></td></tr></tbody>
            </table>
            <p v-else class="muted-copy">Issuance months have not been saved yet.</p>
            <section class="supply-breakdown" :aria-label="`Formula ${index+1} approved unit calculation`">
                <h4>Supply Plan</h4>
                <p class="supply-plan-formula">{{ product(authorization)?.formulaDescription?.trim() || authorization.formulaName || authorization.productName }}</p>
                <p class="approved-supply-total">{{supplies[index]!.total}} {{unitLabel(supplies[index]!.total)}} Approved</p>
                <RequestSupplySources :rows="supplies[index]!.rows" />
                <p v-if="supplies[index]!.pending" class="muted-copy">Still to supply: {{supplies[index]!.pending}} {{unitLabel(supplies[index]!.pending)}}.</p>
                <p v-if="supplies[index]!.unknown" class="muted-copy">Confirm Units Per Case to complete the supply quantities.</p>
            </section>
            <div v-if="assigned(authorization)>0" class="local-surplus-use">
                <div><strong>Local Agency surplus: {{assigned(authorization)}} {{unitLabel(assigned(authorization))}} reserved</strong><p class="muted-copy">This is a one-time stock reservation. Issue it in the earliest benefit months first; distributor or transfer stock covers later months.</p></div>
            </div>
        </fieldset>
        <div class="detail-grid"><div class="detail-field-wide"><span>Next Steps</span><strong class="preserve-lines">{{request.nextSteps || '—'}}</strong></div></div>
    </section>
</template>

<style scoped>
.supply-plan-formula {margin:0 0 8px;font-size:1.15rem;font-weight:750;line-height:1.3;}
.issuance-summary-months {width:100%;border-collapse:collapse;margin-top:14px;text-align:left;}
.issuance-summary-months th {font-size:var(--form-label-size);font-weight:400;color:var(--muted);padding:0 12px 6px 0;}
.issuance-summary-months td {padding:6px 12px 6px 0;font-size:1rem;font-weight:600;border-top:1px solid var(--line);}
.local-surplus-use {display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:8px;}
.local-surplus-use p {margin:4px 0 0;}
.supply-breakdown {margin-top:20px;padding:16px;border:2px solid light-dark(#002595,#75baff);border-radius:10px;}
.supply-breakdown h4 {margin:0 0 12px;font-size:1rem;}
.supply-breakdown p {margin:8px 0;font-size:.875rem;}
.supply-breakdown .approved-supply-total {color:light-dark(#002595,#75baff);font-size:1.15rem;font-weight:700;line-height:1.35;}
</style>
