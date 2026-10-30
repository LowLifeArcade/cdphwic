<script setup lang="ts">
import type {DistributorProfile} from '~/../shared/distributors';
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const canEdit=computed(()=>identity.value!=='agency');
const {data,refresh}=await useFetch<{distributors:DistributorProfile[]}>('/api/distributors',{headers:computed(()=>({'x-demo-user':identity.value})),watch:[identity]});
const blank=()=>({name:'',labelsRequired:false,imagesRequired:false,replacementBasis:'units' as 'units'|'cases',instructions:''});
const form=ref<Partial<DistributorProfile>>(blank());const saving=ref(false);const error=ref('');const status=ref('');
async function save(){saving.value=true;error.value='';try{await $fetch('/api/distributors',{method:'POST',headers:{'x-demo-user':identity.value},body:form.value});await refresh();form.value=blank();status.value='Distributor saved.';}catch(e){error.value=(e as any).data?.statusMessage??'Could not save distributor. Reload and try again.';}finally{saving.value=false;}}
watch(identity,()=>{form.value=blank();error.value='';status.value='';});
</script>
<template>
 <div class="page-heading"><h1>Distributors</h1><p>Damage evidence and replacement requirements shown to local agencies at receipt confirmation.</p></div>
 <section v-if="canEdit" class="panel distributor-editor"><h2>{{form.id?'Edit Distributor':'Add Distributor'}}</h2>
 <form @submit.prevent="save"><div class="form-grid">
 <label class="field-label">Distributor Name<input v-model="form.name" class="form-input" required maxlength="200" /></label>
 <label class="field-label">Replacement Basis<select v-model="form.replacementBasis" class="form-input"><option value="units">Individual cans/cartons</option><option value="cases">Whole case</option></select></label>
 <label class="field-label"><input v-model="form.labelsRequired" type="checkbox" /> Labels must be sent back</label>
 <label class="field-label"><input v-model="form.imagesRequired" type="checkbox" /> Images required as proof of damage</label>
 <label class="field-label detail-field-wide">Instructions<textarea v-model="form.instructions" class="form-textarea" maxlength="4000" /></label>
 </div><div class="distributor-actions"><button class="button button-primary" :disabled="saving">{{saving?'Saving…':'Save Distributor'}}</button><button v-if="form.id" type="button" class="button button-ghost" @click="form=blank()">Cancel</button></div></form>
 <p v-if="error" role="alert" class="receipt-error">{{error}}</p><p v-if="status" role="status">{{status}}</p></section>
 <section class="panel"><h2>Distributor Requirements</h2><p v-if="!data?.distributors.length">No distributors have been added.</p>
 <div v-for="item in data?.distributors" :key="item.id" class="distributor-row"><h3>{{item.name}}</h3><p>Labels: {{item.labelsRequired?'Required for damage':'Not required'}} · Images: {{item.imagesRequired?'Required for damage':'Not required'}} · Replacement: {{item.replacementBasis==='units'?'Individual cans/cartons':'Whole case'}}</p><p class="instructions">{{item.instructions}}</p><button v-if="canEdit" class="button button-secondary" :aria-label="`Edit ${item.name}`" @click="form={...item};status=''">Edit</button></div></section>
</template>
<style scoped>.distributor-editor{margin-bottom:20px}.distributor-actions{display:flex;gap:12px;margin-top:16px}.distributor-row{padding:16px 0;border-top:1px solid var(--line)}.instructions{white-space:pre-wrap}.receipt-error{color:var(--red)}</style>
