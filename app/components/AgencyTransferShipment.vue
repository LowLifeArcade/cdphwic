<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import type {SurplusTransfer} from '~/../shared/surplus';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const quantityTracking=shipmentFeatureFlags(useRuntimeConfig().public).quantityTracking;
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const busy=ref(false);const error=ref('');
const destination=computed(()=>{try{return JSON.parse(props.transfer.destination_shipping??'null') as import('~/../shared/shipping').RequestShipping|null;}catch{return null;}});
async function ship(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/ship`,{method:'POST',headers:{'x-demo-user':identity.value}});emit('updated');}catch(e){error.value=(e as any).data?.statusMessage??'Transfer could not be shipped.';}finally{busy.value=false;}}
</script>
<template>
 <article :id="`transfer-${transfer.id}`" class="transfer-shipment" tabindex="-1">
  <div class="panel-heading"><h3>{{sourceName}} → {{destinationName}}</h3><strong>{{transfer.status==='reserved'?'Reserved':transfer.status==='shipped'?'In Transit':transfer.status==='received'?'Received':transfer.status==='cancelled'?'Cancelled':'Blocked — expired'}}</strong></div>
  <p>{{transfer.formula_name}} · {{transfer.form}}<template v-if="transfer.flavor"> · {{transfer.flavor}}</template></p>
  <p>{{transfer.quantity}} units · {{transfer.units_per_case}} units per case · Expires {{formatDisplayDate(transfer.expiration_date)}} · Request #{{transfer.request_id}}</p>
  <div v-if="destination" class="shipping-address-field"><span class="detail-field-heading">Shipping Address</span><address>{{destinationName}}<template v-if="destination.attention"><br />Attn: {{destination.attention}}</template><br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}<template v-if="destination.email"><br />{{destination.email}}</template><template v-if="destination.phone"><br />{{destination.phone}}</template></address></div>
  <div v-if="transfer.status==='reserved'" class="transfer-ship-form">
   <template v-if="transfer.eta && transfer.tracking_reference"><p>ETA: {{formatDisplayDate(transfer.eta)}} · GSO</p><p>{{transfer.tracking_reference}}</p>
   <button v-if="canShip" class="button button-secondary" type="button" :disabled="busy" @click="ship">{{busy?'Saving…':'Confirm Shipment'}}</button>
   <p v-else>Awaiting shipment confirmation from {{sourceName}}.</p></template>
   <p v-else>Awaiting ETA and tracking details from CDPH/WIC.</p>
  </div>
  <template v-else-if="transfer.status==='shipped'||transfer.status==='received'"><p>ETA: {{formatDisplayDate(transfer.eta)}} · GSO</p><p v-if="transfer.tracking_reference">{{transfer.tracking_reference}}</p><p v-if="quantityTracking && transfer.received_units!==null && transfer.received_units!==undefined">Received: {{transfer.received_units}} units<template v-if="transfer.damaged_units"> · Damaged: {{transfer.damaged_units}} units</template> · Missing: {{Math.max(0,transfer.quantity-transfer.received_units)}} units</p><p v-else-if="transfer.status!=='received'">Awaiting receipt confirmation in the receiving agency’s request.</p></template>
  <p v-if="error" class="form-error" role="alert">{{error}}</p>
 </article>
</template>
<style scoped>.transfer-shipment:target{outline:2px solid var(--purple);outline-offset:3px;scroll-margin:24px}.transfer-shipment{border:1px solid var(--line);padding:18px;border-radius:10px;margin:14px 0}.transfer-shipment .panel-heading{flex-wrap:wrap;gap:12px}.transfer-shipment h3{font-size:18px;margin:0}.transfer-ship-form{display:grid;gap:14px;margin-top:16px}.transfer-ship-form button{justify-self:start}.transfer-shipment address{font-style:normal}.transfer-shipment p{overflow-wrap:anywhere}</style>
