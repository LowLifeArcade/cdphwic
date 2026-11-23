<script setup lang="ts">
import type {PurchaseOrder,PoPreview} from '../../../shared/mckessonPo';
const identity=useState<'admin'|'internal'|'agency'>('demo-identity',()=> 'admin');
const reviewer=computed(()=>identity.value!=='agency');
const headers=computed(()=>({'x-demo-user':identity.value}));
const route=useRoute();
const {data,error:loadError,refresh}=await useFetch<{pos:PurchaseOrder[]}>('/api/mckesson-pos',{headers,watch:[identity]});
const uploading=ref(route.query.upload==='1');
const number=ref('');const startDate=ref('');const endDate=ref('');const fileInput=ref<HTMLInputElement>();
const selectedId=ref<number>();const preview=ref<PoPreview>();const busy=ref(false);const error=ref('');const message=ref('');
const pos=computed(()=>data.value?.pos??[]);
const selected=computed(()=>pos.value.find(po=>po.id===selectedId.value));
watch(pos,rows=>{if(!rows.some(row=>row.id===selectedId.value))selectedId.value=rows[0]?.id;},{immediate:true});
const template='data:text/csv;charset=utf-8,'+encodeURIComponent('Product Number,Formula Description,McKesson Price,Cases Approved,Cases Already Used\r\n851823006997,Kate Farms Pediatric Standard 1.2 Vanilla,42.50,500,0\r\n');
function failure(e:unknown){const x=e as {data?:{message?:string;statusMessage?:string;data?:{message?:string}};message?:string};return x.data?.data?.message||x.data?.statusMessage||x.data?.message||x.message||'Unable to save PO.';}
function invalidate(){preview.value=undefined;error.value='';}
async function review(){
 error.value='';message.value='';preview.value=undefined;
 const file=fileInput.value?.files?.[0];if(!file){error.value='Choose a CSV or Excel file.';return;}
 const body=new FormData();body.append('file',file);body.append('number',number.value);body.append('startDate',startDate.value);body.append('endDate',endDate.value);
 busy.value=true;try{preview.value=(await $fetch<{po:PoPreview}>('/api/mckesson-pos/preview',{method:'POST',headers:headers.value,body})).po;}catch(e){error.value=failure(e);}finally{busy.value=false;}
}
async function activate(){
 if(!preview.value)return;busy.value=true;error.value='';
 try{const po=preview.value;await $fetch('/api/mckesson-pos',{method:'POST',headers:headers.value,body:{number:po.number,startDate:po.startDate,endDate:po.endDate,allocations:po.allocations.map(row=>({productCode:row.productCode,casesApproved:row.casesApproved,casesAlreadyUsed:row.casesAlreadyUsed}))}});await refresh();selectedId.value=pos.value.find(row=>row.number===po.number)?.id;preview.value=undefined;uploading.value=false;message.value=`PO ${po.number} activated. Previous POs and orders are preserved.`;}catch(e){error.value=failure(e);}finally{busy.value=false;}
}
watch(identity,()=>{preview.value=undefined;message.value='';});
</script>
<template>
 <div class="page-heading"><div><p class="eyebrow">Catalog</p><h1>McKesson purchase orders</h1><p>Manage purchasing periods, approved cases, and order balances.</p></div><NuxtLink class="button button-secondary" to="/products">Back to Products</NuxtLink></div>
 <p v-if="!reviewer" role="alert">Only CDPH/WIC and Admin can manage purchase orders.</p>
 <template v-else>
 <p v-if="loadError" role="alert">Unable to load purchase orders. Please try again.</p><p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p>
 <button v-if="!uploading" class="button button-primary" type="button" @click="uploading=true">Upload New McKesson PO</button>
 <section v-if="uploading" class="panel form-panel"><h2>Upload New McKesson PO</h2><p>Enter the effective dates for orders placed against this PO. Previous purchasing periods remain available.</p>
 <form @submit.prevent="review">
 <div class="detail-grid"><label class="field-label">PO number<input v-model="number" class="form-input" required maxlength="100" @input="invalidate" /></label><label class="field-label">Effective start date<input v-model="startDate" class="form-input" type="date" required @input="invalidate" /></label><label class="field-label">Effective end date<input v-model="endDate" class="form-input" type="date" :min="startDate" required @input="invalidate" /></label></div>
 <p>Include Product Number, McKesson Price, Cases Approved, and Cases Already Used. McKesson Price is dollars per case; blank keeps the catalog price. Enter 0 for unused allocation. Formula Description is optional. Format Product Number as text in Excel to preserve leading zeroes.</p>
 <a :href="template" download="mckesson-po-template.csv">Download example CSV template</a>
 <label class="field-label">Allocation spreadsheet<input ref="fileInput" type="file" accept=".csv,.xls,.xlsx" required @change="invalidate" /></label>
 <div class="form-actions"><button class="button button-secondary" type="button" :disabled="busy" @click="uploading=false;preview=undefined">Cancel</button><button class="button button-primary" :disabled="busy" type="submit">{{busy?'Checking…':'Preview allocations'}}</button></div>
 </form>
 <section v-if="preview" aria-label="PO upload preview"><h3>Review PO {{preview.number}}</h3><p>{{preview.startDate}} through {{preview.endDate}} · {{preview.allocations.length}} products</p><div class="product-list"><table class="product-catalog-table"><thead><tr><th>Product Number</th><th>Product</th><th>McKesson Price / Case</th><th>Cases approved</th><th>Already used</th><th>Remaining</th></tr></thead><tbody><tr v-for="row in preview.allocations" :key="row.productCode"><td>{{row.productCode}}</td><td>{{row.formulaDescription||row.productName}}</td><td>{{row.mcKessonPrice===undefined?'—':`$${row.mcKessonPrice.toFixed(2)}`}}</td><td>{{row.casesApproved}}</td><td>{{row.casesAlreadyUsed}}</td><td>{{row.casesRemaining}}</td></tr></tbody></table></div><button class="button button-primary" type="button" :disabled="busy" @click="activate">{{busy?'Activating…':'Activate PO'}}</button></section>
 </section>
 <section class="panel form-panel"><h2>PO history and balances</h2><p v-if="!pos.length&&!loadError">No purchase orders have been uploaded.</p><label v-else class="field-label">Purchase order<select v-model="selectedId" class="form-input"><option v-for="po in pos" :key="po.id" :value="po.id">{{po.number}} · {{po.startDate}} – {{po.endDate}}</option></select></label>
 <template v-if="selected"><h3>{{selected.number}}</h3><p>Effective {{selected.startDate}} through {{selected.endDate}}. Used includes opening usage and placed orders, excluding cancellations.</p><div class="product-list"><table class="product-catalog-table" aria-label="PO product balances"><thead><tr><th>Product Number</th><th>Product</th><th>McKesson Price / Case</th><th>Approved</th><th>Opening usage</th><th>Used</th><th>Remaining</th></tr></thead><tbody><tr v-for="row in selected.allocations" :key="row.productCode"><td>{{row.productCode}}</td><td>{{row.formulaDescription||row.productName}}</td><td>{{row.mcKessonPrice===undefined?'—':`$${row.mcKessonPrice.toFixed(2)}`}}</td><td>{{row.casesApproved}}</td><td>{{row.casesAlreadyUsed}}</td><td>{{row.casesUsed}}</td><td>{{row.casesRemaining}}</td></tr></tbody></table></div><h3>Order history</h3><p v-if="!selected.orders?.length">No orders recorded against this PO.</p><div v-else class="product-list"><table class="product-catalog-table" aria-label="PO order history"><thead><tr><th>Request</th><th>Product Number</th><th>Placed</th><th>Cases</th><th>Status</th></tr></thead><tbody><tr v-for="order in selected.orders" :key="order.id"><td><NuxtLink :to="`/requests?request=${order.requestId}`">{{order.requestId}}</NuxtLink></td><td>{{order.productCode}}</td><td>{{order.orderDate}}</td><td>{{order.cases}}</td><td>{{order.status}}</td></tr></tbody></table></div></template>
 </section></template>
</template>
