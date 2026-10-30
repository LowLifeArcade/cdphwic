<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
const shipmentFeatures=shipmentFeatureFlags(useRuntimeConfig().public);
import {shipmentQuantities,formatShipmentUnits,shipmentUnitSize,validUnitSize} from '~/../shared/shipmentQuantities';
import type {RequestRecord} from '~/../shared/domain';
import type {RequestShipment} from '~/../shared/requestShipments';
import {requestShipments} from '~/../shared/requestShipments';
import {shipmentReceived,shipmentDispatched,shipmentReceiptKey} from '~/../shared/shipmentReceipts';
import {shipmentReceivedCases,shipmentDisposedCases,shipmentCaseKey,type ShipmentCaseCommand} from '~/../shared/shipmentCaseTracking';
const props=defineProps<{request:RequestRecord;shipment:RequestShipment;index:number;canManage:boolean;disabled?:boolean}>();
const emit=defineEmits<{updated:[request:RequestRecord]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const mode=ref<ShipmentCaseCommand['action']|null>(null);
const loose=ref<string|number>(0);const fromDamaged=ref(false);
const quantities=computed(()=>shipmentQuantities(props.request,props.shipment));
const cases=ref('');const notes=ref('');const saving=ref(false);const error=ref('');const feedback=ref('');
const key=ref('');const expectedCases=ref('');
const received=computed(()=>shipmentReceivedCases(props.request,props.shipment));
const disposed=computed(()=>shipmentDisposedCases(props.shipment));
const canClose=computed(()=>!shipmentReceived(props.request,props.shipment) && !props.shipment.replacedAt && requestShipments(props.request).some(row=>row.replacementFor===props.index && (row.replacedAt || (shipmentReceived(props.request,row) && shipmentQuantities(props.request,row).usableUnits>0))));
function start(action:ShipmentCaseCommand['action']) {
    mode.value=action;cases.value=String(action==='received-count'?Math.floor(received.value):0);loose.value=action==='received-count'?quantities.value.receivedUnits%quantities.value.size:0;fromDamaged.value=quantities.value.damagedHeldUnits>0;notes.value='';error.value='';feedback.value='';
    key.value=shipmentReceiptKey(props.shipment);expectedCases.value=shipmentCaseKey(props.shipment);
}
async function submit(action=mode.value) {
    if (!action) return;
    const editing=action!=='replacement';
    const command:ShipmentCaseCommand={expectedReplacements:requestShipments(props.request).filter(row=>row.replacementFor===props.index).length,index:props.index,key:editing?key.value:shipmentReceiptKey(props.shipment),expectedCases:editing?expectedCases.value:shipmentCaseKey(props.shipment),action,...(editing?{cases:cases.value===''?undefined:Number(cases.value),looseUnits:Number(loose.value),fromDamaged:fromDamaged.value,notes:notes.value}:{})};
    saving.value=true;error.value='';feedback.value='';
    try {
        const result=await $fetch<{request:RequestRecord}>(`/api/requests/${props.request.id}`,{method:'PUT',headers:{'x-demo-user':identity.value},body:{shipmentCases:command}});
        emit('updated',result.request);mode.value=null;feedback.value=action==='replacement'?'Replacement shipment added. Enter its quantity, ETA and tracking details.':'Shipment case information saved.';
    } catch (failure) {const detail=failure as {data?:{statusMessage?:string};statusMessage?:string};error.value=detail.data?.statusMessage ?? detail.statusMessage ?? 'Case information could not be saved. Please try again.';}
    finally {saving.value=false;}
}
</script>

<template>
    <div class="shipment-case-panel">
        <p v-if="shipment.replacementFor!==undefined" class="replacement-link">Replacement for Shipment {{shipment.replacementFor+1}}</p>
        <p v-if="shipment.replacedAt && !shipmentReceived(request,shipment)"><strong>Closed as replaced</strong> · {{shipment.replacementClosureNote}}<br />If the original arrives later, record its cases and confirm receipt.</p>
        <div v-if="shipmentFeatures.caseReconciliation && shipmentDispatched(request,shipment)" class="case-counts"><span>Received: <strong>{{formatShipmentUnits(quantities.receivedUnits,quantities.size)}}</strong></span><span>Returned/Destroyed: <strong>{{formatShipmentUnits(quantities.disposedUnits,quantities.size)}}</strong></span><span>Damaged Held: <strong>{{formatShipmentUnits(quantities.damagedHeldUnits,quantities.size)}}</strong></span><span>Usable Kept: <strong>{{formatShipmentUnits(quantities.usableUnits,quantities.size)}}</strong></span></div>
        <ul v-if="shipmentFeatures.caseReconciliation && shipment.dispositions?.length" class="case-dispositions"><li v-for="(item,itemIndex) in shipment.dispositions" :key="itemIndex">{{formatShipmentUnits(item.units ?? item.cases*shipmentUnitSize(shipment),shipmentUnitSize(shipment))}} {{item.kind}} · {{item.notes}}</li></ul>
        <div v-if="!mode" class="case-actions">
            <template v-if="shipmentFeatures.caseReconciliation && received>disposed">
                <button class="button button-ghost" type="button" :disabled="disabled || saving" :aria-label="`Document return for shipment ${index+1}`" @click="start('returned')">Document Return</button>
                <button class="button button-ghost" type="button" :disabled="disabled || saving" :aria-label="`Document destruction for shipment ${index+1}`" @click="start('destroyed')">Document Destruction</button>
            </template>
            <button v-if="canManage && shipment.issue" class="button button-secondary" type="button" :disabled="disabled || saving" :aria-label="`Create replacement for shipment ${index+1}`" @click="submit('replacement')">Create Replacement Shipment</button>
            <button v-if="canManage && canClose" class="button button-secondary" type="button" :disabled="disabled || saving" :aria-label="`Close shipment ${index+1} as replaced`" @click="start('close-replaced')">Close Original as Replaced</button>
        </div>
        <div v-if="mode" class="case-editor">
            <strong>{{mode==='received-count'?'Actual Cases Received (cumulative total)':mode==='returned'?'Document Returned Cases':mode==='destroyed'?'Document Destroyed Cases':'Close Original as Replaced'}}</strong>
            <label v-if="mode!=='close-replaced'" class="field-label">Cases<input v-model="cases" class="form-input" type="number" min="0" step="1" :disabled="saving" :aria-label="`Shipment ${index+1} case quantity`" /></label>
            <label v-if="mode!=='close-replaced'" class="field-label">Loose Units<input v-model="loose" class="form-input" type="number" min="0" :max="shipmentUnitSize(shipment)-1" step="1" :disabled="saving || !validUnitSize(shipment.unitsPerCase)" :aria-label="`Shipment ${index+1} disposition loose units`" /></label>
            <label v-if="mode==='returned' || mode==='destroyed'" class="field-label"><input v-model="fromDamaged" type="checkbox" :disabled="saving" /> Apply to damaged product first</label>
            <label class="field-label">Notes / Document Reference<textarea v-model="notes" class="form-textarea" maxlength="4000" :disabled="saving" :aria-label="`Shipment ${index+1} case notes`" placeholder="Document the receipt count, return, destruction or replacement closure." /></label>
            <div class="case-actions"><button class="button button-secondary" type="button" :disabled="disabled || saving" @click="submit()">{{saving?'Saving…':'Save Case Information'}}</button><button class="button button-ghost" type="button" :disabled="saving" @click="mode=null;error=''">Cancel</button></div>
        </div>
        <p v-if="error" class="case-error" role="alert">{{error}}</p><p v-if="feedback" role="status">{{feedback}}</p>
    </div>
</template>
<style scoped>
.shipment-case-panel {margin-top:12px;}
.case-counts,.case-actions {display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:10px;}
.case-counts {font-size:14px;}
.case-editor {display:grid;gap:12px;margin-top:12px;}
.replacement-link {font-weight:700;color:var(--purple-light);}
.case-error {color:var(--red);}
.case-dispositions {font-size:14px;padding-left:18px;overflow-wrap:anywhere;}
</style>
