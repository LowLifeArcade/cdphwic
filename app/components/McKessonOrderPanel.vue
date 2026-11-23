<script setup lang="ts">
import type {ProductRecord,RequestRecord} from '../../shared/domain';
import {candidateProducts} from '../../shared/productMatching';
import {poToday,isMcKessonPo,type PurchaseOrder,type PoOrder as Order,type PoOrderInput} from '~/../shared/mckessonPo';
const props=defineProps<{request:RequestRecord;products:ProductRecord[]}>();
const emit=defineEmits<{changed:[]}>();
const identity=useState<'admin'|'internal'|'agency'>('demo-identity',()=> 'admin');
const headers=computed(()=>({'x-demo-user':identity.value}));
const {data,error:loadError,refresh}=await useFetch<{pos:PurchaseOrder[]}>('/api/mckesson-pos',{headers,watch:[identity]});
const pos=computed(()=>data.value?.pos??[]);
const today=poToday();
const pendingOrder=ref<PoOrderInput>();
const orderDate=ref(today);const productCode=ref('');const poId=ref<number>();const cases=ref<number>();const busy=ref(false);const error=ref('');const message=ref('');const editCases=reactive<Record<string,number>>({});
const availableProducts=computed(()=>{
 const formulas=props.request.requestedFormulas?.length?props.request.requestedFormulas:[{productName:props.request.productName,productForm:props.request.productForm}];
 const ids=new Set(formulas.flatMap(f=>candidateProducts(props.products,{name:('otherFormulaName' in f&&f.otherFormulaName)||f.productName,form:f.productForm})).map(p=>p.id));
 for(const authorization of props.request.formulaAuthorizations??[]){const p=props.products.find(p=>p.productCode===authorization.productCode);if(p)ids.add(p.id);}
 return props.products.filter(p=>ids.has(p.id)&&isMcKessonPo(p.mcKessonPo));
});
const applicable=computed(()=>pos.value.filter(po=>po.startDate<=orderDate.value&&po.endDate>=orderDate.value&&po.allocations.some(a=>a.productCode===productCode.value)));
const selectedPo=computed(()=>applicable.value.find(po=>po.id===poId.value));
const allocation=computed(()=>selectedPo.value?.allocations.find(a=>a.productCode===productCode.value));
const orders=computed(()=>pos.value.flatMap(po=>po.orders.filter(o=>o.requestId===props.request.id).map(o=>({...o,poNumber:po.number}))));
watch(availableProducts,rows=>{if(!rows.some(p=>p.productCode===productCode.value))productCode.value=rows.length===1?rows[0]!.productCode:'';},{immediate:true});
watch([orderDate,productCode,()=>data.value],()=>{poId.value=applicable.value.length===1?applicable.value[0]!.id:undefined;},{immediate:true});
const canPlace=computed(()=>!loadError.value&&!!allocation.value&&Number.isSafeInteger(cases.value)&&cases.value!>0&&cases.value!<=allocation.value.casesRemaining&&!busy.value);
function failure(e:unknown){const x=e as {data?:{message?:string;statusMessage?:string;data?:{message?:string}};message?:string};return x.data?.data?.message||x.data?.statusMessage||x.data?.message||x.message||'Unable to update order.';}
async function place(){
 if(!pendingOrder.value&&!canPlace.value)return;busy.value=true;error.value='';message.value='';
 pendingOrder.value??={id:crypto.randomUUID(),requestId:props.request.id,productCode:productCode.value,cases:cases.value!,orderDate:orderDate.value,poId:poId.value!};
 try{
  await $fetch('/api/mckesson-pos/orders',{method:'POST',headers:headers.value,body:pendingOrder.value});
  pendingOrder.value=undefined;cases.value=undefined;message.value='Order recorded. Cases deducted from the selected PO.';emit('changed');
  try{await refresh();if(loadError.value)throw loadError.value;}catch{error.value='Order was recorded, but balances could not be refreshed. Reload before placing another order.';}
 }catch(e){
  const status=(e as {statusCode?:number;status?:number}).statusCode??(e as {status?:number}).status;
  if(status&&status>=400&&status<500){pendingOrder.value=undefined;error.value=failure(e);}
  else error.value=failure(e)+' Retry uses the same order reference to avoid duplicate charges.';
 }finally{busy.value=false;}
}
async function checkPendingOrder(){
 if(!pendingOrder.value)return;busy.value=true;error.value='';
 try{await refresh();if(loadError.value)throw loadError.value;
  const found=pos.value.flatMap(po=>po.orders).find(order=>order.id===pendingOrder.value!.id);
  if(found){message.value='Order was recorded. Its PO balance is shown below.';cases.value=undefined;pendingOrder.value=undefined;emit('changed');}
  else message.value='The order is not confirmed yet. Retry with the same reference to avoid duplicate charges.';
 }catch{error.value='Unable to confirm order status. Retry this same order reference to avoid duplicate charges.';}finally{busy.value=false;}
}
async function updateOrder(order:Order,status:'placed'|'cancelled'){
 busy.value=true;error.value='';message.value='';
 try{await $fetch(`/api/mckesson-pos/orders/${order.id}`,{method:'PUT',headers:headers.value,body:{cases:status==='cancelled'?order.cases:editCases[order.id]??order.cases,status,version:order.version}});await refresh();delete editCases[order.id];message.value=status==='cancelled'?'Order cancelled. Cases restored to its original PO.':'Order quantity updated on its original PO.';emit('changed');}catch(e){error.value=failure(e);}finally{busy.value=false;}
}
</script>
<template>
 <section v-if="identity!=='agency'" class="panel form-panel" aria-label="Record McKesson order"><h2>Record McKesson order</h2><p>Record an order already placed with McKesson. This does not send an order to McKesson. Saving approval or shipment details does not deduct PO cases. Save request changes before placing an order.</p>
 <p v-if="loadError" role="alert">Unable to load PO balances. <button type="button" class="button button-secondary" @click="refresh()">Retry</button></p><p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p>
 <p v-if="!availableProducts.length">No matching McKesson PO products. Save the selected exact product in the issuance details first.</p>
 <p v-if="pendingOrder" role="status">An order submission is awaiting confirmation. Retry the same order before changing these details. <button type="button" class="button button-secondary" :disabled="busy" @click="checkPendingOrder">Check order status</button></p><form v-if="availableProducts.length" @submit.prevent="place"><div class="detail-grid">
 <label class="field-label">Exact product<select v-model="productCode" class="form-input" required  :disabled="busy||!!pendingOrder"><option value="">Select exact product</option><option v-for="p in availableProducts" :key="p.id" :value="p.productCode">{{p.formulaDescription||p.name}} · {{p.productCode}}</option></select></label>
 <label class="field-label">Order placement date<input v-model="orderDate" type="date" class="form-input" required  :disabled="busy||!!pendingOrder" /></label>
 <label class="field-label">McKesson PO<select v-model="poId" class="form-input" required  :disabled="busy||!!pendingOrder"><option :value="undefined">Select applicable PO</option><option v-for="po in applicable" :key="po.id" :value="po.id">{{po.number}} · {{po.startDate}} – {{po.endDate}}</option></select></label>
 <label class="field-label">Cases to order<input v-model.number="cases" type="number" min="1" step="1" :max="allocation?.casesRemaining" class="form-input" required  :disabled="busy||!!pendingOrder" /></label></div>
 <p v-if="productCode&&!applicable.length">No PO allocation covers this product and date. <NuxtLink to="/products/pos?upload=1">Upload a PO</NuxtLink> before placing the order.</p><p v-if="applicable.length>1&&!selectedPo">Multiple POs cover this date. Select the PO to charge.</p>
 <p v-if="allocation" role="status">Cases approved: <strong>{{allocation.casesApproved}}</strong> · Used: <strong>{{allocation.casesUsed}}</strong> · Remaining: <strong>{{allocation.casesRemaining}}</strong><template v-if="Number.isSafeInteger(cases)&&cases!>0"> · Balance after order: <strong>{{allocation.casesRemaining-cases!}}</strong></template></p>
 <button type="submit" class="button button-primary" :disabled="busy||(!pendingOrder&&!canPlace)">{{busy?'Saving…':pendingOrder?'Retry recording same order':'Record order placed'}}</button>
 </form>
 <template v-if="orders.length"><h3>Orders for this request</h3><div class="product-list"><table class="product-catalog-table" aria-label="McKesson order history"><thead><tr><th>PO</th><th>Product Number</th><th>Placed</th><th>Cases</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr v-for="order in orders" :key="order.id"><td>{{order.poNumber}}</td><td>{{order.productCode}}</td><td>{{order.orderDate}}</td><td><input v-if="order.status==='placed'" :aria-label="`Cases for order ${order.id}`" class="form-input" type="number" min="1" step="1" :value="editCases[order.id]??order.cases"  :disabled="busy||!!pendingOrder" @input="editCases[order.id]=Number(($event.target as HTMLInputElement).value)" /><template v-else>{{order.cases}}</template></td><td>{{order.status}}</td><td><template v-if="order.status==='placed'"><button type="button" class="button button-secondary" :disabled="busy||!!pendingOrder||!Number.isSafeInteger(editCases[order.id]??order.cases)||(editCases[order.id]??order.cases)<1" @click="updateOrder(order,'placed')">Save quantity</button><button type="button" class="button button-secondary"  :disabled="busy||!!pendingOrder" @click="updateOrder(order,'cancelled')">Cancel order</button></template><span v-else>Cases restored</span></td></tr></tbody></table></div></template>
 </section>
</template>
