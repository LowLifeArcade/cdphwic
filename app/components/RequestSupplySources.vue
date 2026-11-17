<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import {supplyCaseDetails,type SupplySourceRow} from '~/../shared/issuanceSupply';
defineProps<{rows:SupplySourceRow[]}>();
</script>
<template>
    <dl class="supply-sources">
        <div v-for="row in rows" :key="row.key" :class="{'source-surplus':row.kind==='surplus'}">
            <dt>{{row.label}}<small v-if="row.pending">{{row.kind==='distributor'?(row.draftUpdate?'Draft update — not sent':'Draft — ETA not sent'):'Selected — not reserved'}}</small></dt>
            <dd><strong>{{row.units===undefined?'—':`${row.units} ${unitLabel(row.units)}`}}</strong><small v-if="row.kind==='distributor'">{{supplyCaseDetails(row)}}</small></dd>
        </div>
    </dl>
</template>
<style scoped>
.supply-sources {margin:0;}
.supply-sources>div {display:flex;justify-content:space-between;gap:16px;padding:7px 0;}
.supply-sources dt {min-width:0;overflow-wrap:anywhere;}
.supply-sources dd {margin:0;text-align:right;flex-shrink:0;}
.supply-sources small {display:block;color:var(--muted);font-size:.8rem;margin-top:3px;}
.supply-sources .source-surplus {border-top:1px solid var(--line);margin-top:6px;padding-top:12px;}
@media(max-width:540px){.supply-sources>div {flex-wrap:wrap;}.supply-sources dd {margin-left:auto;}}
</style>
