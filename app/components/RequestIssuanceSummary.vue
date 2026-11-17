<script setup lang="ts">
import type {ProductRecord,RequestRecord} from '~/../shared/domain';
import {formulaAuthorizations,formatIssuanceMonth,type FormulaAuthorization} from '~/../shared/formulaAuthorizations';
import {issuanceSupply} from '~/../shared/issuanceSupply';
import {formulaFormLabel} from '~/../shared/requestPresentation';
const props=defineProps<{request:RequestRecord;products?:ProductRecord[]}>();
const emit=defineEmits<{recordIssue:[command:{formulaIndex:number;month:string;units:number}]}>();
const authorizations=computed(()=>formulaAuthorizations(props.request));
const supplies=computed(()=>authorizations.value.map(row=>issuanceSupply(props.request,row)));
function orderConversion(index:number){
 const supply=supplies.value[index]!;
 if(!supply.orderedCases&&!supply.orderedLooseUnits)return '';
 const cases=supply.orderedCases?`${supply.orderedCases} case(s)${supply.orderSizes.length===1?` × ${supply.orderSizes[0]} unit(s)`: ' (mixed case sizes)'}`:'';
 const loose=supply.orderedLooseUnits?`${supply.orderedLooseUnits} loose unit(s)`:'';
 return `${[cases,loose].filter(Boolean).join(' + ')} =`;
}
function product(row:FormulaAuthorization){return props.products?.find(product=>product.name===row.productName&&product.form===row.productForm);}
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
                <div><span>Formula Name</span><strong>{{authorization.formulaName||authorization.productName}}<template v-if="authorization.flavor"> · {{authorization.flavor}}</template></strong></div>
                <div><span>Form</span><strong>{{formulaFormLabel(authorization.productForm)}}</strong></div>
                <div><span>Product Number</span><strong>{{authorization.productCode||product(authorization)?.productCode||'—'}}</strong></div>
                <div><span>Units Per Case</span><strong>{{authorization.unitsPerCase??product(authorization)?.unitsPerCase??'—'}}</strong></div>
                <div><span>Yield</span><strong>{{(authorization.yield??product(authorization)?.yield)!==undefined?`${authorization.yield??product(authorization)?.yield} fl oz`:'—'}}</strong></div>
            </div>
            <table v-if="authorization.benefitIssuances.some(row=>row.month)" class="issuance-summary-months">
                <thead><tr><th scope="col">Month</th><th scope="col">Approved Quantity</th><th v-if="assigned(authorization)>0" scope="col">Local Surplus Issue</th></tr></thead>
                <tbody><tr v-for="issuance in authorization.benefitIssuances.filter(row=>row.month)" :key="issuance.month"><td>{{formatIssuanceMonth(issuance.month)}}</td><td>{{issuance.quantity}} Unit(s)</td><td v-if="assigned(authorization)"><template v-if="issuedForMonth(authorization,issuance.month)">{{issuedForMonth(authorization,issuance.month)}} unit(s) recorded</template><button v-else-if="localIssueTarget(authorization,issuance.month)>0" class="button button-secondary" type="button" :disabled="!earlierLocalIssuesComplete(authorization,issuance.month)" @click="emit('recordIssue',{formulaIndex:index,month:issuance.month,units:localIssueTarget(authorization,issuance.month)})">Confirm {{localIssueTarget(authorization,issuance.month)}} unit(s) issued</button><template v-else>—</template></td></tr></tbody>
            </table>
            <p v-else class="muted-copy">Issuance months have not been saved yet.</p>
            <section class="supply-breakdown" :aria-label="`Formula ${index+1} approved unit calculation`">
                <h4>How the approved units are supplied</h4>
                <dl class="supply-equation">
                    <div><dt><span aria-hidden="true" class="equation-sign"></span>Local Agency Surplus</dt><dd>{{supplies[index]!.local}} unit(s)</dd></div>
                    <div><dt><span aria-hidden="true" class="equation-sign">+</span>Transferred</dt><dd>{{supplies[index]!.transferred}} unit(s)</dd></div>
                    <div><dt><span aria-hidden="true" class="equation-sign">+</span>Ordered</dt><dd><span v-if="orderConversion(index)" class="case-conversion">{{orderConversion(index)}}</span> {{supplies[index]!.orderedUnits}} unit(s)</dd></div>
                    <div v-if="supplies[index]!.pending"><dt><span aria-hidden="true" class="equation-sign">+</span>Pending Allocation</dt><dd>{{supplies[index]!.pending}} unit(s)</dd></div>
                    <div v-if="supplies[index]!.surplus" class="supply-surplus"><dt><span aria-hidden="true" class="equation-sign">−</span>Expected Surplus</dt><dd>{{supplies[index]!.surplus}} unit(s)</dd></div>
                    <div class="supply-total"><dt><span aria-hidden="true" class="equation-sign">=</span>Total Unit(s) Approved</dt><dd>{{supplies[index]!.total}} unit(s)</dd></div>
                </dl>
                <p v-if="supplies[index]!.surplus" class="muted-copy">The supplied quantity exceeds the approved total by {{supplies[index]!.surplus}} unit(s). These remaining units are expected surplus.</p>
                <p v-if="supplies[index]!.pending" class="muted-copy">{{supplies[index]!.pending}} approved unit(s) still need a recorded order or transfer.</p>
                <p v-if="supplies[index]!.unknownOrderSize" class="muted-copy">An order is awaiting a confirmed units-per-case quantity before it can be included.</p>
            </section>
            <div v-if="assigned(authorization)>0" class="local-surplus-use">
                <div><strong>Local Agency surplus: {{assigned(authorization)}} unit(s) reserved</strong><p class="muted-copy">This is a one-time stock reservation. Issue it in the earliest benefit months first; distributor or transfer stock covers later months.</p></div>
            </div>
        </fieldset>
        <div class="detail-grid"><div class="detail-field-wide"><span>Next Steps</span><strong class="preserve-lines">{{request.nextSteps || '—'}}</strong></div></div>
    </section>
</template>

<style scoped>
.issuance-summary-months {width:100%;border-collapse:collapse;margin-top:14px;text-align:left;}
.issuance-summary-months th {font-size:var(--form-label-size);font-weight:400;color:var(--muted);padding:0 12px 6px 0;}
.issuance-summary-months td {padding:6px 12px 6px 0;font-size:1rem;font-weight:600;border-top:1px solid var(--line);}
.local-surplus-use {display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:8px;}
.local-surplus-use p {margin:4px 0 0;}
.supply-breakdown {margin-top:20px;padding:16px;border:1px solid var(--line);border-radius:10px;}
.supply-breakdown h4 {margin:0 0 12px;font-size:1rem;}
.supply-equation {margin:0;}
.supply-equation>div {display:flex;justify-content:space-between;gap:16px;padding:8px 0;}
.supply-equation dt {display:flex;align-items:baseline;}
.supply-equation dd {margin:0;text-align:right;font-weight:600;}
.equation-sign {display:inline-block;flex:0 0 22px;font-weight:700;}
.case-conversion {color:var(--muted);font-weight:400;}
.supply-equation .supply-total {border-top:2px solid var(--line);margin-top:6px;padding-top:14px;color:light-dark(#002595,#75baff);font-weight:700;}
.supply-breakdown p {margin:10px 0 0;}
@media(max-width:540px){.supply-equation>div {flex-direction:column;gap:4px;}.supply-equation dd {text-align:left;padding-left:22px;}}
</style>
