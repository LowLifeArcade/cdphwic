<script setup lang="ts">
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import type {SurplusTransfer} from '~/../shared/surplus';
import type {RequestShipment} from '~/../shared/requestShipments';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const quantityTracking=shipmentFeatureFlags(useRuntimeConfig().public).quantityTracking;
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const eta=ref('');const carrier=ref<RequestShipment['carrier']>('agency');const tracking=ref('');const busy=ref(false);const error=ref('');
const destination=computed(()=>{try{return JSON.parse(props.transfer.destination_shipping??'null') as import('~/../shared/shipping').RequestShipping|null;}catch{return null;}});
async function ship(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/ship`,{method:'POST',headers:{'x-demo-user':identity.value},body:{eta:eta.value,carrier:carrier.value,trackingNumbers:tracking.value.split(/\r?\n/).map(t=>t.trim()).filter(Boolean)}});emit('updated');}catch(e){error.value=(e as any).data?.statusMessage??'Transfer could not be shipped.';}finally{busy.value=false;}}
</script>
<template>
 <article class="transfer-shipment">
  <div class="panel-heading"><h3>{{sourceName}} → {{destinationName}}</h3><strong>{{transfer.status==='reserved'?'Reserved':transfer.status==='shipped'?'In Transit':transfer.status==='received'?'Received':transfer.status==='cancelled'?'Cancelled':'Blocked — expired'}}</strong></div>
  <p>{{transfer.formula_name}} · {{transfer.form}}<template v-if="transfer.flavor"> · {{transfer.flavor}}</template></p>
  <p>{{transfer.quantity}} units · {{transfer.units_per_case}} units per case · Expires {{formatDisplayDate(transfer.expiration_date)}} · Request #{{transfer.request_id}}</p>
  <div v-if="destination" class="shipping-address-field"><span class="detail-field-heading">Shipping Address</span><address>{{destinationName}}<br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}<template v-if="destination.email"><br />{{destination.email}}</template><template v-if="destination.phone"><br />{{destination.phone}}</template></address></div>
  <form v-if="canShip && transfer.status==='reserved'" class="transfer-ship-form" @submit.prevent="ship">
   <div class="form-grid"><label class="field-label">ETA *<input v-model="eta" required type="date" class="form-input" :disabled="busy" /></label><label class="field-label">Carrier<select v-model="carrier" class="form-input" :disabled="busy"><option value="agency">Agency Delivery</option><option value="ups">UPS</option><option value="fedex">FedEx</option><option value="dhl">DHL</option></select></label></div>
   <label class="field-label">Tracking / Delivery Reference *<textarea v-model="tracking" required class="form-textarea" placeholder="Tracking number or local delivery reference" :disabled="busy" /></label>
   <button class="button button-secondary" type="submit" :disabled="busy">{{busy?'Saving…':'Confirm Shipment & Send ETA'}}</button>
  </form>
  <template v-else-if="transfer.status==='shipped'||transfer.status==='received'"><p>ETA: {{formatDisplayDate(transfer.eta)}} · {{transfer.carrier==='agency'?'Agency Delivery':transfer.carrier?.toUpperCase()}}</p><p v-if="transfer.tracking_reference">{{transfer.tracking_reference}}</p><p v-if="quantityTracking && transfer.received_units!==null && transfer.received_units!==undefined">Received: {{transfer.received_units}} units<template v-if="transfer.damaged_units"> · Damaged: {{transfer.damaged_units}} units</template> · Missing: {{Math.max(0,transfer.quantity-transfer.received_units)}} units</p><p v-else-if="transfer.status!=='received'">Awaiting receipt confirmation in the receiving agency’s request.</p></template>
  <p v-else-if="transfer.status==='reserved'">Awaiting shipment from {{sourceName}}.</p>
  <p v-if="error" class="form-error" role="alert">{{error}}</p>
 </article>
</template>
<style scoped>.transfer-shipment{border:1px solid var(--line);padding:18px;border-radius:10px;margin:14px 0}.transfer-shipment .panel-heading{flex-wrap:wrap;gap:12px}.transfer-shipment h3{font-size:18px;margin:0}.transfer-ship-form{display:grid;gap:14px;margin-top:16px}.transfer-ship-form button{justify-self:start}.transfer-shipment address{font-style:normal}.transfer-shipment p{overflow-wrap:anywhere}</style>
