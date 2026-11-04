<script setup lang="ts">
import type {TransferShippingLabel} from '~/../shared/transferShippingLabels';
const props=defineProps<{transferId:string;canUpload:boolean;allowUpload?:boolean}>();
const emit=defineEmits<{ready:[boolean]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const endpoint=computed(()=>`/api/request-transfers/${props.transferId}/labels`);
const {data,refresh,error:loadError}=await useFetch<{labels:TransferShippingLabel[]}>(endpoint,{headers:computed(()=>({'x-demo-user':identity.value})),server:false});
watch(()=>data.value?.labels,labels=>emit('ready',!!labels?.length),{immediate:true});
const busy=ref(false);const error=ref('');const message=ref('');
let timer:ReturnType<typeof setInterval>|undefined;
function refreshVisible(){if(!document.hidden)void refresh();}
onMounted(()=>{timer=setInterval(refreshVisible,60000);window.addEventListener('focus',refreshVisible);});
onBeforeUnmount(()=>{if(timer)clearInterval(timer);window.removeEventListener('focus',refreshVisible);});
async function upload(event:Event){
 const input=event.target as HTMLInputElement;const files=Array.from(input.files??[]);if(!files.length)return;
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
  <h4>Shipping Labels</h4>
  <label v-if="canUpload && allowUpload!==false" class="field-label">Upload Shipping Labels<input type="file" multiple accept="application/pdf,image/png,image/jpeg" :disabled="busy || (data?.labels.length??0)>=10" @change="upload" /><small>PDF, PNG, or JPEG · Up to 10 files, 10 MB each</small></label>
  <ul v-if="data?.labels.length"><li v-for="label in data.labels" :key="label.id"><span>{{label.fileName}}</span><div class="label-actions"><button class="text-button" type="button" @click="openLabel(label,false)">Download</button><button class="text-button" type="button" @click="openLabel(label,true)">Open / Print</button></div></li></ul>
  <p v-else-if="!loadError" class="muted-copy">Shipping labels have not been uploaded.</p>
  <p v-if="loadError || error" class="form-error" role="alert">{{error || 'Shipping labels could not be loaded. Please refresh.'}}</p>
  <p v-if="message" role="status">{{message}}</p>
 </section>
</template>
<style scoped>
.transfer-labels {margin-top:12px;padding-top:10px;border-top:1px solid var(--line);}
.transfer-labels h4 {margin:0 0 8px;font-size:14px;font-weight:600;}
.transfer-labels ul {list-style:none;padding:0;margin:8px 0;display:grid;gap:8px;}
.transfer-labels li {display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:6px 12px;overflow-wrap:anywhere;}
.label-actions {display:flex;gap:12px;}
.transfer-labels p {margin:8px 0;font-size:14px;}
</style>
