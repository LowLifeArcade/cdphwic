<script setup lang="ts">
import type {TransferShippingLabel} from '~/../shared/transferShippingLabels';
const props=defineProps<{transferId:string;canUpload:boolean;allowUpload?:boolean}>();
const emit=defineEmits<{ready:[boolean]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const endpoint=computed(()=>`/api/request-transfers/${props.transferId}/labels`);
const {data,refresh,error:loadError}=await useFetch<{labels:TransferShippingLabel[];requestedLabelCount:number}>(endpoint,{headers:computed(()=>({'x-demo-user':identity.value})),server:false});
const labelsComplete=computed(()=>!!data.value?.requestedLabelCount&&data.value.labels.length===data.value.requestedLabelCount);
watch(labelsComplete,ready=>emit('ready',ready),{immediate:true});
const busy=ref(false);const error=ref('');const message=ref('');
let timer:ReturnType<typeof setInterval>|undefined;
function refreshVisible(){if(!document.hidden)void refresh();}
onMounted(()=>{timer=setInterval(refreshVisible,60000);window.addEventListener('focus',refreshVisible);});
onBeforeUnmount(()=>{if(timer)clearInterval(timer);window.removeEventListener('focus',refreshVisible);});
async function upload(event:Event){
 const input=event.target as HTMLInputElement;const files=Array.from(input.files??[]);if(!files.length)return;
 const remaining=(data.value?.requestedLabelCount??0)-(data.value?.labels.length??0);if(files.length>remaining){error.value=`Select no more than ${remaining} remaining label(s).`;input.value='';return;}
 busy.value=true;error.value='';message.value='';let uploaded=0;
 try{for(const file of files){const body=new FormData();body.append('file',file);await $fetch(endpoint.value,{method:'POST',headers:{'x-demo-user':identity.value},body});uploaded++;}}
 catch(e){error.value=(e as {data?:{statusMessage?:string}}).data?.statusMessage??'Shipping labels could not all be uploaded.';}
 finally{await refresh();busy.value=false;input.value='';if(uploaded)message.value=`${uploaded} shipping label${uploaded===1?'':'s'} uploaded.`;}
}
async function openLabel(label:TransferShippingLabel,print:boolean){
 const preview=print?window.open('','_blank'):null;if(preview)preview.opener=null;
 error.value='';
 try{const blob=await $fetch<Blob>(`${endpoint.value}/${label.id}`,{headers:{'x-demo-user':identity.value},responseType:'blob'});const url=URL.createObjectURL(blob);
  if(print){if(preview)preview.location.href=url;else {URL.revokeObjectURL(url);throw new Error('Allow a new tab to open, or download the label to print it.');}}
  else{const link=document.createElement('a');link.href=url;link.download=label.fileName;link.click();}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){preview?.close();error.value=(e as {data?:{statusMessage?:string}}).data?.statusMessage??(e as Error).message??'Shipping label could not be opened.';}
}
</script>
<template>
 <section class="transfer-labels" aria-label="Shipping Labels">
  <div class="transfer-labels-header">
   <h4>Shipping Labels</h4>
   <span v-if="data?.requestedLabelCount" class="label-progress">{{ data.labels.length }} of {{ data.requestedLabelCount }} uploaded</span>
  </div>
  <label v-if="canUpload && allowUpload!==false && !labelsComplete" class="field-label label-upload">
   Upload Shipping Labels
   <input type="file" multiple accept="application/pdf,image/png,image/jpeg" :disabled="busy || !data?.requestedLabelCount" @change="upload" />
   <small>PDF, PNG, or JPEG · 10 MB per file</small>
  </label>
  <ol v-if="data?.labels.length" class="label-files">
   <li v-for="(label, index) in data.labels" :key="label.id">
    <span class="label-file-name">{{ label.fileName }}</span>
    <div class="label-actions">
     <button class="text-button" type="button" :aria-label="`Download shipping label ${index + 1}`" @click="openLabel(label,false)">Download</button>
     <button class="text-button" type="button" :aria-label="`Open or print shipping label ${index + 1}`" @click="openLabel(label,true)">Open / Print</button>
    </div>
   </li>
  </ol>
  <p v-else-if="!loadError" class="muted-copy">{{ data ? 'Shipping labels have not been uploaded.' : 'Loading shipping labels…' }}</p>
  <p v-if="loadError || error" class="form-error" role="alert">{{error || 'Shipping labels could not be loaded. Please refresh.'}}</p>
  <p v-if="message" role="status">{{message}}</p>
 </section>
</template>
<style scoped>
.transfer-labels {margin-top:8px;padding:12px;border:1px solid var(--line);border-radius:8px;}
.transfer-labels-header {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;}
.transfer-labels h4 {margin:0;font-size:14px;font-weight:700;}
.label-progress {color:var(--muted);font-size:12px;white-space:nowrap;}
.label-upload {margin:10px 0 0;}
.label-files {list-style:none;padding:0;margin:8px 0 0;}
.label-files li {display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:6px 12px;padding:8px 0;border-top:1px solid var(--line);}
.label-file-name {flex:1 1 140px;min-width:0;overflow-wrap:anywhere;}
.label-actions {display:flex;flex-wrap:wrap;gap:4px 12px;}
.transfer-labels p {margin:8px 0 0;font-size:13px;}
</style>
