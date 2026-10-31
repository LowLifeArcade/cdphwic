<script setup lang="ts">
import type {SurplusTransfer} from '~/../shared/surplus';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const busy=ref(false);const error=ref('');
const formulaLabel=computed(()=>`${props.transfer.formula_name} ${{powder:'Powder',concentrate:'Liquid Concentrate','ready-to-feed':'RTF'}[props.transfer.form]??props.transfer.form}`);
const destination=computed(()=>{try{return JSON.parse(props.transfer.destination_shipping??'null') as import('~/../shared/shipping').RequestShipping|null;}catch{return null;}});
async function ship(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/ship`,{method:'POST',headers:{'x-demo-user':identity.value}});emit('updated');}catch(e){error.value=(e as any).data?.statusMessage??'Transfer could not be shipped.';}finally{busy.value=false;}}
</script>
<template>
 <article :id="`transfer-${transfer.id}`" class="transfer-shipment" tabindex="-1">
  <header class="transfer-heading">
   <h3>{{sourceName}} → {{destinationName}}</h3>
   <span class="transfer-status" :class="{'shipment-transit-status':transfer.status==='shipped'}">{{transfer.status==='reserved'?'Transfer Requested':transfer.status==='shipped'?'In Transit':transfer.status==='received'?'Received':transfer.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span>
  </header>
  <strong class="transfer-product">{{formulaLabel}}</strong>
  <div class="transfer-details">
   <div><span class="transfer-label">Unit(s)</span><strong>{{transfer.quantity}}</strong></div>
   <div><span class="transfer-label">Expiration Date</span><span>{{formatDisplayDate(transfer.expiration_date)}}</span></div>
   <div><span class="transfer-label">ETA</span><span>{{formatDisplayDate(transfer.eta)}}</span></div>
   <div><span class="transfer-label">Carrier</span><span>GSO</span></div>
   <div class="transfer-tracking"><span class="transfer-label">Tracking Numbers</span><span>{{transfer.tracking_reference || '—'}}</span></div>
  </div>
  <div class="transfer-address">
   <span class="transfer-label">Shipping Address</span>
   <address v-if="destination">{{destinationName}}<template v-if="destination.attention"><br />Attn: {{destination.attention}}</template><br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}</address>
   <span v-else class="transfer-label">Shipping address has not been provided.</span>
  </div>
  <div v-if="transfer.status==='reserved'" class="transfer-actions">
   <template v-if="transfer.eta && transfer.tracking_reference">
    <button v-if="canShip" class="button button-secondary" type="button" :disabled="busy" @click="ship">{{busy?'Saving…':'Confirm Transfer'}}</button>
    <p v-else>Awaiting shipment confirmation from {{sourceName}}.</p>
   </template>
   <p v-else>Awaiting ETA and tracking details from CDPH/WIC.</p>
  </div>
  <p v-if="error" class="form-error" role="alert">{{error}}</p>
 </article>
</template>
<style scoped>
.transfer-shipment:target {outline:2px solid var(--purple);outline-offset:3px;scroll-margin:24px;}
.transfer-shipment {border:1px solid var(--line);padding:12px 16px;border-radius:10px;margin:10px 0;font-size:14px;line-height:1.45;}
.transfer-heading {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px;}
.transfer-heading h3 {font-size:16px;margin:0;}
.transfer-status {font-size:12px;font-weight:600;border:1px solid var(--line);border-radius:12px;padding:2px 9px;}
.transfer-product {display:block;}
.transfer-label {display:block;color:var(--muted);font-size:13px;margin-bottom:2px;font-weight:400;}
.transfer-details {display:grid;grid-template-columns:minmax(60px,.55fr) minmax(110px,.9fr) minmax(110px,.9fr) minmax(70px,.6fr) minmax(180px,1.6fr);gap:8px 16px;margin-top:6px;}
.transfer-tracking {min-width:0;overflow-wrap:anywhere;white-space:pre-wrap;}
@media(max-width:800px){.transfer-details{grid-template-columns:repeat(2,minmax(0,1fr));}.transfer-tracking{grid-column:1/-1;}}
.transfer-address {margin-top:8px;}
.transfer-address address {font-style:normal;font-size:14px;line-height:1.4;}
.transfer-actions {margin-top:8px;}
.transfer-actions p {margin:8px 0 0;}
.transfer-shipment p {overflow-wrap:anywhere;}
</style>
