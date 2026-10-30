<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import {refreshReceiptEvidence} from '~/../shared/receiptEvidenceRetry';
import type {RequestRecord} from '~/../shared/domain';
import type {RequestShipment} from '~/../shared/requestShipments';
import {shipmentReceived,shipmentDispatched,shipmentReceiptKey} from '~/../shared/shipmentReceipts';
import {shipmentQuantities,validUnitSize,shipmentUnitSize,inputShipmentUnits,formatShipmentUnits,receiptQuantityKey} from '~/../shared/shipmentQuantities';
import {shipmentIssueKey} from '~/../shared/shipmentIssues';
import {formatEtaDate,submissionDateOnly} from '~/../shared/requestPresentation';
const props=defineProps<{request:RequestRecord;shipment:RequestShipment;index:number;canConfirm:boolean;catalogUnitsPerCase?:number;disabled?:boolean}>();
const emit=defineEmits<{updated:[request:RequestRecord];editing:[value:boolean]}>();
const receiptQuantities=shipmentFeatureFlags(useRuntimeConfig().public).receiptQuantities;
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const cases=ref<string|number>('');const loose=ref<string|number>(0);const damagedCases=ref<string|number>(0);const damagedLoose=ref<string|number>(0);
const editing=ref(false);const damage=ref(false);const notes=ref('');const files=ref<File[]>([]);
const saving=ref(false);const error=ref('');const feedback=ref('');const key=ref('');const expected=ref('');const expectedIssue=ref('');
const evidenceRetry=shallowRef<RequestRecord|null>(null);
const receiptShipment=computed(()=>!validUnitSize(props.shipment.unitsPerCase)&&validUnitSize(props.catalogUnitsPerCase)?{...props.shipment,unitsPerCase:props.catalogUnitsPerCase}:props.shipment);
const quantities=computed(()=>shipmentQuantities(props.request,receiptShipment.value));
const size=computed(()=>shipmentUnitSize(receiptShipment.value));
const hasReceipt=computed(()=>!!props.shipment.receivedAt||!!props.shipment.receiptConfirmed||props.shipment.receivedCases!==undefined||props.shipment.receivedUnits!==undefined||shipmentReceived(props.request,props.shipment));
const showEntry=computed(()=>props.canConfirm&&shipmentDispatched(props.request,props.shipment)&&(!hasReceipt.value||editing.value));
watch(showEntry,value=>emit('editing',value),{immediate:true});
function reset(){
    cases.value=hasReceipt.value&&props.shipment.receiptMode!=='simple'?Math.floor(quantities.value.receivedUnits/size.value):'';
    loose.value=hasReceipt.value?quantities.value.receivedUnits%size.value:0;
    damagedCases.value=Math.floor(quantities.value.damagedUnits/size.value);damagedLoose.value=quantities.value.damagedUnits%size.value;
    damage.value=receiptQuantities?quantities.value.damagedUnits>0:!!props.shipment.issue&&!props.shipment.issue.resolvedAt;notes.value=props.shipment.issue?.notes??'';
    key.value=shipmentReceiptKey(props.shipment);expected.value=receiptQuantityKey(props.shipment);expectedIssue.value=shipmentIssueKey(props.shipment);
}
watch(()=>`${props.request.id}:${receiptQuantityKey(props.shipment)}:${shipmentReceiptKey(props.shipment)}:${receiptShipment.value.unitsPerCase??''}`,reset,{immediate:true});
function editReceipt(){reset();files.value=[];evidenceRetry.value=null;editing.value=true;error.value='';feedback.value='';}
function cancel(){reset();files.value=[];editing.value=false;error.value='';}
function finishLater(){evidenceRetry.value=null;files.value=[];editing.value=false;error.value='';feedback.value='Receipt saved. Remaining images can be attached under Damage Evidence.';}
function toggleDamage(){if(!damage.value){damagedCases.value=0;damagedLoose.value=0;files.value=[];}}
function chooseImages(event:Event){
    const selected=Array.from((event.target as HTMLInputElement).files??[]);
    if(selected.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>10*1024*1024)){files.value=[];error.value='Choose JPEG, PNG or WebP images of 10 MB or less.';return;}
    if(selected.length+(props.shipment.issue?.images?.length??0)>10){files.value=[];error.value='Up to 10 damage images may be attached to each issue.';return;}
    files.value=selected;error.value='';
}
const preview=computed(()=>{
    if(String(cases.value).trim()==='')return null;
    try{
        const received=inputShipmentUnits(receiptShipment.value,Number(cases.value),Number(loose.value));
        const damaged=inputShipmentUnits(receiptShipment.value,Number(damagedCases.value),Number(damagedLoose.value));
        const held=Math.max(0,damaged-quantities.value.disposedDamagedUnits);
        if(damaged>received||received<quantities.value.disposedUnits||damaged<quantities.value.disposedDamagedUnits||received-quantities.value.disposedUnits-held<0)return null;
        return {received,damaged,missing:Math.max(0,quantities.value.expectedUnits-received)};
    }catch{return null;}
});
const hasDamage=computed(()=>receiptQuantities?!!preview.value?.damaged:damage.value);
const discrepancy=computed(()=>receiptQuantities?!!preview.value&&(preview.value.missing>0||preview.value.damaged>0):damage.value);
const missingImages=computed(()=>hasDamage.value&&props.shipment.distributorPolicy?.imagesRequired&&!props.shipment.issue?.images?.length&&!files.value.length);
async function submit(){
    if(!evidenceRetry.value&&((receiptQuantities&&!preview.value)||missingImages.value))return;
    if(!evidenceRetry.value && !hasDamage.value)files.value=[];
    saving.value=true;editing.value=true;error.value='';feedback.value='';
    try{
        let record=evidenceRetry.value;
        if(record){
            record=await refreshReceiptEvidence(record,props.index,async()=>{
                const fresh=await $fetch<{request:RequestRecord}>(`/api/requests/${record!.id}`,{headers:{'x-demo-user':identity.value}});return fresh.request;
            });
            evidenceRetry.value=record;emit('updated',record);
        }
        if(!record){
            const selection={...(!validUnitSize(props.shipment.unitsPerCase)&&validUnitSize(props.catalogUnitsPerCase)?{catalogUnitsPerCase:props.catalogUnitsPerCase}:{}),index:props.index,key:key.value,expectedReceipt:expected.value,expectedIssue:expectedIssue.value,issueNotes:notes.value,receivedCases:Number(cases.value),receivedLooseUnits:Number(loose.value),damagedCases:Number(damagedCases.value),damagedLooseUnits:Number(damagedLoose.value)};
            const result=await $fetch<{request:RequestRecord}>(`/api/requests/${props.request.id}`,{method:'PUT',headers:{'x-demo-user':identity.value},body:receiptQuantities?{confirmShipmentReceipts:[selection]}:{confirmShipmentReceipt:{index:props.index,key:key.value,expectedReceipt:expected.value,expectedIssue:expectedIssue.value,damaged:damage.value,issueNotes:notes.value}}});
            record=result.request;evidenceRetry.value=record;emit('updated',record);
        }
        while(files.value.length){
            const body=new FormData();body.append('file',files.value[0]!);body.append('index',String(props.index));body.append('expectedIssue',shipmentIssueKey(record.shipments![props.index]!));
            const result=await $fetch<{request:RequestRecord}>(`/api/requests/${record.id}/evidence`,{method:'POST',headers:{'x-demo-user':identity.value},body});
            record=result.request;evidenceRetry.value=record;files.value.shift();emit('updated',record);
        }
        evidenceRetry.value=null;editing.value=false;
        feedback.value=discrepancy.value?'Receipt confirmed. The shipment issue was sent to CDPH/WIC.':'Receipt confirmed.';
    }catch(failure){
        const detail=failure as {data?:{statusMessage?:string};statusMessage?:string};
        const message=detail.data?.statusMessage??detail.statusMessage??(failure instanceof Error?failure.message:'Please try again.');
        error.value=evidenceRetry.value?`Receipt saved, but damage images could not all be uploaded. ${message}`:`Receipt could not be saved. ${message}`;
    }finally{saving.value=false;}
}
</script>

<template>
    <div class="shipment-receipt-panel">
        <div v-if="hasReceipt && !showEntry" class="receipt-summary">
            <div class="shipping-save-action">
                <strong :class="shipmentReceived(request,shipment)?'shipment-received-label':'shipment-partial-label'">{{shipmentReceived(request,shipment)?'Received':'Partially Received'}}<template v-if="shipment.receivedAt"> · {{formatEtaDate(submissionDateOnly(shipment.receivedAt))}}</template></strong>
                <button v-if="canConfirm && shipmentDispatched(request,shipment)" class="text-button" type="button" :disabled="disabled || saving" :aria-label="`Edit Receipt for shipment ${index+1}`" @click="editReceipt">Edit Receipt</button>
            </div>
            <p v-if="receiptQuantities && shipment.receiptMode!=='simple'">Received: {{formatShipmentUnits(quantities.receivedUnits,size)}}<template v-if="quantities.damagedUnits"> · Damaged: {{formatShipmentUnits(quantities.damagedUnits,size)}}</template><template v-if="quantities.missingUnits"> · Missing: {{formatShipmentUnits(quantities.missingUnits,size)}}</template></p>
        </div>
        <div v-if="showEntry" class="receipt-entry">
            <strong>{{hasReceipt?'Edit Shipment Receipt':'Confirm Shipment Receipt'}}</strong>
            <div v-if="receiptQuantities" class="form-grid compact-form-grid">
                <label class="field-label">Cases Received *<input v-model="cases" type="number" min="0" step="1" required class="form-input" :aria-label="`Shipment ${index+1} cases received`" :disabled="disabled || saving || !!evidenceRetry" /></label>
                <label class="field-label">Loose Units Received<input v-model="loose" type="number" min="0" :max="size-1" step="1" class="form-input" :aria-label="`Shipment ${index+1} loose units received`" :disabled="disabled || saving || !!evidenceRetry || !validUnitSize(receiptShipment.unitsPerCase)" /></label>
            </div>
            <label class="receipt-damage-toggle"><input v-model="damage" type="checkbox" :disabled="disabled || saving || !!evidenceRetry || (receiptQuantities && !validUnitSize(receiptShipment.unitsPerCase))" @change="toggleDamage" /><span>Some product arrived damaged</span></label>
            <div v-if="receiptQuantities && damage" class="form-grid compact-form-grid">
                <label class="field-label">Damaged Cases (included above)<input v-model="damagedCases" type="number" min="0" step="1" class="form-input" :aria-label="`Shipment ${index+1} damaged cases`" :disabled="disabled || saving || !!evidenceRetry" /></label>
                <label class="field-label">Damaged Loose Units (included above)<input v-model="damagedLoose" type="number" min="0" :max="size-1" step="1" class="form-input" :aria-label="`Shipment ${index+1} damaged loose units`" :disabled="disabled || saving || !!evidenceRetry" /></label>
            </div>
            <p v-if="receiptQuantities && preview" class="receipt-quantity-summary" aria-live="polite">Received: {{formatShipmentUnits(preview.received,size)}} · Missing: {{formatShipmentUnits(preview.missing,size)}}<template v-if="preview.damaged"> · Damaged: {{formatShipmentUnits(preview.damaged,size)}}</template></p>
            <label v-if="discrepancy || shipment.issue" class="field-label">Issue Notes<textarea v-model="notes" class="form-textarea" maxlength="4000" :aria-label="`Shipment ${index+1} receipt issue notes`" :disabled="disabled || saving || !!evidenceRetry" /></label>
            <label v-if="hasDamage" class="field-label">Damage Images<template v-if="shipment.distributorPolicy?.imagesRequired"> *</template><input type="file" multiple accept="image/jpeg,image/png,image/webp" :disabled="disabled || saving" :aria-label="`Shipment ${index+1} receipt damage images`" @change="chooseImages" /></label>
            <p v-if="files.length" class="muted-copy">{{files.length}} image(s) ready to upload.</p>
            <p v-if="missingImages" class="receipt-error">Attach at least one damage image as required by this distributor.</p>
            <p v-if="receiptQuantities && String(cases).trim()!=='' && !preview" class="receipt-error">Check the quantities. Damaged product must be included in the received total; documented returns or destruction must remain accounted for.</p>
            <div class="receipt-actions">
                <button class="button button-secondary" type="button" :disabled="disabled || saving || (!evidenceRetry && ((receiptQuantities && !preview) || missingImages))" :aria-label="`${evidenceRetry?'Retry damage images':hasReceipt?'Save Receipt':'Confirm Receipt'} for shipment ${index+1}`" @click="submit">{{saving?'Saving…':evidenceRetry?'Retry Damage Images':hasReceipt?'Save Receipt':'Confirm Receipt'}}</button>
                <button v-if="evidenceRetry" class="button button-ghost" type="button" :disabled="saving" @click="finishLater">Finish Later</button>
                <button v-if="hasReceipt && !evidenceRetry" class="button button-ghost" type="button" :disabled="saving" @click="cancel">Cancel</button>
            </div>
        </div>
        <p v-if="error" class="receipt-error" role="alert">{{error}}</p><p v-if="feedback" role="status">{{feedback}}</p>
    </div>
</template>
<style scoped>
.shipment-receipt-panel {margin-top:12px;}
.receipt-entry {margin-top:12px;display:grid;gap:10px;}
.receipt-entry p,.receipt-summary p {margin:0;}
.receipt-summary {display:grid;gap:8px;}
.receipt-actions {display:flex;gap:10px;flex-wrap:wrap;}
.receipt-damage-toggle {display:flex;align-items:center;gap:12px;min-height:48px;padding:12px 14px;border:1px solid var(--warning-border,#b56f2c);border-radius:8px;background:var(--warning-bg);color:var(--warning-text);box-sizing:border-box;}
.receipt-damage-toggle span {font-size:16px;font-weight:700;line-height:1.35;}
.receipt-damage-toggle input {width:20px;height:20px;margin:0;flex:0 0 auto;accent-color:var(--purple);}
.receipt-damage-toggle:has(input:checked) {border-color:var(--purple);background:var(--accent-bg);color:var(--accent-text);}
.receipt-damage-toggle:has(input:disabled) {opacity:.6;}
.shipment-received-label {color:var(--success-text);font-weight:800;}
.shipment-partial-label {color:var(--warning-text);font-weight:800;}
.receipt-error {color:var(--red);}
.receipt-quantity-summary {font-weight:600;}
</style>
