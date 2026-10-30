<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
const shipmentFeatures=shipmentFeatureFlags(useRuntimeConfig().public);
import type {RequestRecord} from '~/../shared/domain';
import type {RequestShipment} from '~/../shared/requestShipments';
import {damageEvidenceNeeded} from '~/../shared/distributors';
import {shipmentIssueKey} from '~/../shared/shipmentIssues';
const props=defineProps<{request:RequestRecord;shipment:RequestShipment;index:number;canProvide:boolean}>();
const emit=defineEmits<{updated:[request:RequestRecord]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const date=ref('');const reference=ref('');const saving=ref(false);const error=ref('');const feedback=ref('');const preview=ref('');const fileInput=ref<HTMLInputElement>();
const hasDamage=computed(()=>damageEvidenceNeeded(props.shipment));
watch(()=>props.shipment.issue?.labelsSent,labels=>{date.value=labels?.date??'';reference.value=labels?.reference??'';},{immediate:true});
async function labels(){saving.value=true;error.value='';try{const result=await $fetch<{request:RequestRecord}>(`/api/requests/${props.request.id}/evidence/labels`,{method:'POST',headers:{'x-demo-user':identity.value},body:{index:props.index,expectedIssue:shipmentIssueKey(props.shipment),date:date.value,reference:reference.value}});emit('updated',result.request);feedback.value='Labels sent recorded. Inventory quantities are unchanged.';}catch(e){error.value=(e as any).data?.statusMessage??'Could not record labels.';}finally{saving.value=false;}}
async function upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>10*1024*1024){error.value='Choose an image of 10 MB or less.';return;}saving.value=true;error.value='';const body=new FormData();body.append('file',file);body.append('index',String(props.index));body.append('expectedIssue',shipmentIssueKey(props.shipment));try{const result=await $fetch<{request:RequestRecord}>(`/api/requests/${props.request.id}/evidence`,{method:'POST',headers:{'x-demo-user':identity.value},body});emit('updated',result.request);feedback.value='Damage image uploaded. Inventory quantities are unchanged.';}catch(e){error.value=(e as any).data?.statusMessage??'Could not upload image.';}finally{saving.value=false;if(fileInput.value)fileInput.value.value='';}}
async function view(id:string){error.value='';try{const blob=await $fetch<Blob>(`/api/requests/${props.request.id}/evidence/${id}`,{headers:{'x-demo-user':identity.value},responseType:'blob'});if(preview.value)URL.revokeObjectURL(preview.value);preview.value=URL.createObjectURL(blob);}catch{error.value='Could not open image.';}}
function closePreview(){if(preview.value)URL.revokeObjectURL(preview.value);preview.value='';}
onBeforeUnmount(()=>{if(preview.value)URL.revokeObjectURL(preview.value);});
</script>
<template>
 <div v-if="shipment.issue && (hasDamage || shipment.issue.labelsSent || shipment.issue.images?.length)" class="shipment-evidence"><strong>Damage Evidence</strong><p class="muted-copy"><template v-if="shipment.shipmentSource==='agency'">Images document the condition of the transferred product.</template><template v-else>Sending labels or images does not mean the damaged product was returned.</template> <template v-if="shipmentFeatures.caseReconciliation">Document any physical return or destruction separately.</template></p>
 <p v-if="identity==='agency' && shipment.distributorPolicy?.labelsRequired && !shipment.issue.labelsSent" class="evidence-pending">Labels must be sent back.</p><p v-if="identity==='agency' && shipment.distributorPolicy?.imagesRequired && !shipment.issue.images?.length" class="evidence-pending">Images required as proof of damage.</p>
 <p v-if="shipment.issue.labelsSent">Labels sent: {{shipment.issue.labelsSent.date}} · {{shipment.issue.labelsSent.reference}}</p>
 <form v-if="canProvide && shipment.shipmentSource!=='agency'" @submit.prevent="labels" class="evidence-labels"><label class="field-label">Date Labels Sent<input v-model="date" type="date" required class="form-input" :aria-label="`Shipment ${index+1} labels sent date`" /></label><label class="field-label">Labels Reference<input v-model="reference" required maxlength="1000" class="form-input" :aria-label="`Shipment ${index+1} labels reference`" /></label><button class="button button-secondary" :disabled="saving">Record Labels Sent</button></form>
 <label v-if="canProvide" class="field-label evidence-upload">Damage Images (JPEG, PNG or WebP; up to 10 MB each)<input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" :disabled="saving || (shipment.issue.images?.length??0)>=10" :aria-label="`Shipment ${index+1} damage image`" @change="upload" /></label>
 <div class="image-links"><button v-for="image in shipment.issue.images" :key="image.id" type="button" class="text-button" @click="view(image.id)">{{image.fileName}}</button></div><div v-if="preview"><img :src="preview" alt="Shipment damage evidence" class="evidence-preview" /><button class="button button-ghost" type="button" @click="closePreview">Close Image</button></div>
 <p v-if="error" class="receipt-error" role="alert">{{error}}</p><p v-if="feedback" role="status">{{feedback}}</p>
 </div>
</template>
<style scoped>.shipment-evidence{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:8px}.shipment-evidence p{font-size:14px}.evidence-labels{display:grid;gap:10px;margin:12px 0}.evidence-upload{margin-top:12px}.image-links{display:grid;gap:8px;margin-top:12px}.evidence-preview{max-width:100%;max-height:360px;object-fit:contain}.evidence-pending{color:var(--warning-text)}.receipt-error{color:var(--red)}</style>
