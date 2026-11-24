<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import {formatClinicStreetAddress,type ClinicAddress} from '~/../shared/shipping';
import type {SurplusTransfer} from '~/../shared/surplus';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const busy=ref(false);const error=ref('');
const labelsReady=ref(false);
const requestedLabelCount=ref<number|null>(null);
const route=useRoute();
async function confirmStock(){if(!Number.isSafeInteger(requestedLabelCount.value)||!requestedLabelCount.value||requestedLabelCount.value<1)return;busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/confirm-stock`,{method:'POST',headers:{'x-demo-user':identity.value},body:{requestedLabelCount:requestedLabelCount.value}});emit('updated');window.dispatchEvent(new Event('request-messages-changed'));}catch(e){error.value=(e as any).data?.statusMessage??'Product availability could not be confirmed.';}finally{busy.value=false;}}
const visibleEta=computed(()=>props.canShip||props.transfer.status!=='reserved'?props.transfer.eta:'');
const formulaLabel=computed(()=>`${props.transfer.formula_name} ${{powder:'Powder',concentrate:'Concentrate','ready-to-feed':'RTF'}[props.transfer.form]??props.transfer.form}`);
const destination=computed(()=>{try{return JSON.parse(props.transfer.destination_shipping??'null') as import('~/../shared/shipping').RequestShipping|null;}catch{return null;}});
const pickup=computed(()=>{try{return JSON.parse(props.transfer.source_clinic_address??'null') as ClinicAddress|null;}catch{return null;}});
async function ship(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/ship`,{method:'POST',headers:{'x-demo-user':identity.value}});emit('updated');}catch(e){error.value=(e as any).data?.statusMessage??'Pickup could not be confirmed.';}finally{busy.value=false;}}
</script>
<template>
 <details :id="`transfer-${transfer.id}`" class="transfer-shipment" :class="{'transfer-cancelled':transfer.status==='cancelled'}" :open="String(route.query.transfer??'')===transfer.id">
  <summary class="transfer-collapsed-summary">
   <span class="transfer-collapsed-title"><strong>{{formulaLabel}}<template v-if="transfer.flavor"> · {{transfer.flavor}}</template></strong><small>{{sourceName}} → {{destinationName}}</small></span>
   <span class="transfer-status" :class="{'shipment-transit-status':transfer.status==='shipped'}">{{transfer.status==='reserved'?'Transfer Requested':transfer.status==='shipped'?'In Transit':transfer.status==='received'?'Confirmed Receipt':transfer.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span>
   <span class="transfer-collapsed-quantity">{{transfer.quantity}} {{unitLabel(transfer.quantity)}}</span>
  </summary>
  <div class="transfer-expanded-content">
  <p v-if="transfer.request_id" class="transfer-request-reference">Request #{{transfer.request_id}}</p>
  <div class="transfer-details">
   <div><span class="transfer-label">Units</span><strong>{{transfer.quantity}}</strong></div>
   <div><span class="transfer-label">Expiration Date</span><span>{{formatDisplayDate(transfer.expiration_date)}}</span></div>
   <div><span class="transfer-label">ETA</span><span>{{visibleEta ? formatDisplayDate(visibleEta) : 'Pending GSO pickup'}}</span></div>
   <div v-if="transfer.stock_confirmed_at"><span class="transfer-label">Carrier</span><span>GSO</span></div>
   <div v-if="transfer.stock_confirmed_at" class="transfer-tracking"><span class="transfer-label">Tracking Numbers</span><span>{{transfer.tracking_reference || 'Pending CDPH/WIC shipping details'}}</span></div>
   <div v-if="transfer.requested_label_count"><span class="transfer-label">Shipping Labels Requested</span><span>{{transfer.requested_label_count}}</span></div>
  </div>
  <div class="transfer-address"><span class="transfer-label">Pickup clinic</span><address>{{transfer.source_clinic_name || pickup?.clinicName || 'Clinic not specified'}}<template v-if="pickup"><br />{{formatClinicStreetAddress(pickup)}}</template></address></div>
  <div class="transfer-address">
   <span class="transfer-label">Shipping Address</span>
   <address v-if="destination">{{destinationName}}<template v-if="destination.attention"><br />Attn: {{destination.attention}}</template><br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}</address>
   <span v-else class="transfer-label">Shipping address has not been provided.</span>
  </div>
  <p v-if="transfer.stock_confirmed_at" class="pickup-confirmed" role="status">✓ Sending agency confirmed stock {{formatDisplayDate(transfer.stock_confirmed_at)}}</p>
  <TransferShippingLabels :transfer-id="transfer.id" :can-upload="false" @ready="labelsReady=$event" />
  <TransferPickupInstructions v-if="canShip && transfer.status==='reserved' && transfer.stock_confirmed_at && labelsReady && transfer.eta && transfer.tracking_reference" />
  <p v-if="(transfer.status==='shipped'||transfer.status==='received') && transfer.shipped_date" class="pickup-confirmed" role="status">✓ Pickup confirmed {{formatDisplayDate(transfer.shipped_date)}}</p>
  </div>
  <div v-if="transfer.status==='reserved'" class="transfer-actions">
   <template v-if="!transfer.stock_confirmed_at">
    <template v-if="canShip"><label class="field-label label-count-field">Shipping Label(s) Needed<input v-model.number="requestedLabelCount" class="form-input" type="number" min="1" step="1" inputmode="numeric" :disabled="busy" :aria-label="`Transfer ${transfer.id} number of shipping labels needed`" /><small>Enter how many labels your agency needs for this shipment.</small></label><button class="button button-secondary" type="button" :disabled="busy || !Number.isSafeInteger(requestedLabelCount) || !requestedLabelCount || requestedLabelCount < 1" @click="confirmStock">{{busy?'Saving…':'Confirm Product Availability'}}</button><span class="transfer-action-note">Confirm the full reserved quantity is physically available. Contact CDPH/WIC if short.</span></template>
    <p v-else>Awaiting product availability confirmation from {{sourceName}}.</p>
   </template>
   <template v-else-if="transfer.eta && transfer.tracking_reference && labelsReady">
    <button v-if="canShip" class="button button-secondary" type="button" :disabled="busy" @click="ship">{{busy?'Saving…':'Confirm Pickup'}}</button>
    <p v-else>Awaiting pickup confirmation from {{sourceName}}.</p>
   </template>
   <p v-else>Stock confirmed. Awaiting shipping labels and shipping details from CDPH/WIC.</p>
  </div>
  <NuxtLink v-if="!canShip && identity!=='agency'" class="text-button" :to="{path:'/requests',query:{request:transfer.request_id},hash:`#shipments-${transfer.request_id}`}">Open Request Shipment</NuxtLink>
  <p v-if="error" class="form-error" role="alert">{{error}}</p>
 </details>
</template>
<style scoped>
.transfer-shipment:target {outline:2px solid var(--purple);outline-offset:3px;scroll-margin:24px;}
.transfer-shipment {box-sizing:border-box;display:block;width:100%;max-width:var(--surplus-content-width,1120px);border:1px solid var(--line);padding:0 16px;border-radius:8px;margin:8px 0;font-size:13px;line-height:1.4;}
.transfer-shipment.transfer-cancelled {background:var(--surface-raised);border-color:var(--line);color:var(--muted);}
.transfer-shipment.transfer-cancelled .transfer-status {display:inline-flex;align-items:center;padding:2px 8px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised);color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap;}
.transfer-collapsed-summary {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;padding:12px 0;cursor:pointer;list-style:none;}
.transfer-collapsed-summary::-webkit-details-marker {display:none;}
.transfer-collapsed-summary::after {content:'Details';color:var(--muted);font-size:12px;}
.transfer-shipment[open] > .transfer-collapsed-summary::after {content:'Hide details';}
.transfer-collapsed-title {display:grid;gap:3px;min-width:180px;flex:1;}
.transfer-collapsed-title strong {font-size:14px;}
.transfer-collapsed-title small {font-size:12px;color:var(--muted);}
.transfer-collapsed-quantity {font-size:13px;font-weight:650;white-space:nowrap;}
.transfer-expanded-content {display:grid;gap:8px;padding:0 0 12px;}
.transfer-request-reference {margin:0;color:var(--muted);font-size:12px;}
.transfer-details {display:grid;grid-template-columns:72px 144px 136px 72px minmax(0,1fr);gap:8px 16px;margin:0;font-size:13px;}
.transfer-label {display:block;color:var(--muted);font-size:12px;line-height:1.4;margin-bottom:4px;font-weight:400;}
.transfer-tracking {min-width:0;overflow-wrap:anywhere;white-space:pre-wrap;}
.transfer-address {margin-top:12px;}
.transfer-address address {font-style:normal;font-size:13px;line-height:1.4;}
.transfer-actions {display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:0;}
.transfer-actions .button {font-size:13px;line-height:1.4;padding:6px 10px;min-height:32px;}
.transfer-actions p {margin:0;font-size:13px;line-height:1.4;}
.transfer-action-note {color:var(--muted);font-size:12px;max-width:360px;}
.label-count-field {min-width:min(100%,240px);}
.transfer-shipment > .text-button {justify-self:start;margin:0;font-size:13px;line-height:1.4;}
.transfer-shipment p {overflow-wrap:anywhere;}
.transfer-expanded-content > p {margin:12px 0 0;font-size:13px;}
@media(max-width:800px){.transfer-details{grid-template-columns:repeat(2,minmax(0,1fr));}.transfer-tracking{grid-column:1/-1;}}
</style>
