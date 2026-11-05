<script setup lang="ts">
import {formatClinic,type ClinicAddress} from '~/../shared/shipping';
import type {SurplusTransfer} from '~/../shared/surplus';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const busy=ref(false);const error=ref('');
const labelsReady=ref(false);
const route=useRoute();
async function confirmStock(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/confirm-stock`,{method:'POST',headers:{'x-demo-user':identity.value}});emit('updated');window.dispatchEvent(new Event('request-messages-changed'));}catch(e){error.value=(e as any).data?.statusMessage??'Product availability could not be confirmed.';}finally{busy.value=false;}}
const formulaLabel=computed(()=>`${props.transfer.formula_name} ${{powder:'Powder',concentrate:'Concentrate','ready-to-feed':'RTF'}[props.transfer.form]??props.transfer.form}`);
const destination=computed(()=>{try{return JSON.parse(props.transfer.destination_shipping??'null') as import('~/../shared/shipping').RequestShipping|null;}catch{return null;}});
const pickup=computed(()=>{try{return JSON.parse(props.transfer.source_clinic_address??'null') as ClinicAddress|null;}catch{return null;}});
async function ship(){busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/ship`,{method:'POST',headers:{'x-demo-user':identity.value}});emit('updated');}catch(e){error.value=(e as any).data?.statusMessage??'Pickup could not be confirmed.';}finally{busy.value=false;}}
</script>
<template>
 <article :id="`transfer-${transfer.id}`" class="transfer-shipment" tabindex="-1">
  <header class="transfer-heading">
   <div class="transfer-title"><strong>{{formulaLabel}}<template v-if="transfer.flavor"> · {{transfer.flavor}}</template></strong><span><b>{{sourceName}}</b> → <b>{{destinationName}}</b></span><span>{{transfer.source_clinic_name || 'Clinic not specified'}}</span></div>
   <span class="transfer-status" :class="{'shipment-transit-status':transfer.status==='shipped'}">{{transfer.status==='reserved'?'Transfer Requested':transfer.status==='shipped'?'In Transit':transfer.status==='received'?'Confirmed Receipt':transfer.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span>
  </header>
  <div class="transfer-summary"><span><strong>{{transfer.quantity}}</strong> unit(s)</span><span>Expires {{formatDisplayDate(transfer.expiration_date)}}</span><span>ETA {{transfer.eta ? formatDisplayDate(transfer.eta) : 'Pending'}}</span><span v-if="transfer.request_id">Request #{{transfer.request_id}}</span></div>
  <details class="transfer-expanded" :open="String(route.query.transfer??'')===transfer.id">
  <summary>Shipping details &amp; labels</summary>
  <div class="transfer-details">
   <div><span class="transfer-label">Unit(s)</span><strong>{{transfer.quantity}}</strong></div>
   <div><span class="transfer-label">Expiration Date</span><span>{{formatDisplayDate(transfer.expiration_date)}}</span></div>
   <div><span class="transfer-label">ETA</span><span>{{formatDisplayDate(transfer.eta)}}</span></div>
   <div><span class="transfer-label">Carrier</span><span>GSO</span></div>
   <div class="transfer-tracking"><span class="transfer-label">Tracking Numbers</span><span>{{transfer.tracking_reference || '—'}}</span></div>
  </div>
  <div class="transfer-address"><span class="transfer-label">Pickup clinic</span><address>{{transfer.source_clinic_name || 'Clinic not specified'}}<template v-if="pickup"><br />{{formatClinic(pickup)}}</template></address></div>
  <div class="transfer-address">
   <span class="transfer-label">Shipping Address</span>
   <address v-if="destination">{{destinationName}}<template v-if="destination.attention"><br />Attn: {{destination.attention}}</template><br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}</address>
   <span v-else class="transfer-label">Shipping address has not been provided.</span>
  </div>
  <p v-if="transfer.stock_confirmed_at" class="pickup-confirmed" role="status">✓ Sending agency confirmed stock {{formatDisplayDate(transfer.stock_confirmed_at)}}</p>
  <TransferShippingLabels :transfer-id="transfer.id" :can-upload="false" @ready="labelsReady=$event" />
  <TransferPickupInstructions v-if="canShip && transfer.status==='reserved' && transfer.stock_confirmed_at && labelsReady && transfer.eta && transfer.tracking_reference" />
  <p v-if="(transfer.status==='shipped'||transfer.status==='received') && transfer.shipped_date" class="pickup-confirmed" role="status">✓ Pickup confirmed {{formatDisplayDate(transfer.shipped_date)}}</p>
  </details>
  <div v-if="transfer.status==='reserved'" class="transfer-actions">
   <template v-if="!transfer.stock_confirmed_at">
    <template v-if="canShip"><button class="button button-secondary" type="button" :disabled="busy" @click="confirmStock">{{busy?'Saving…':'Confirm Product Availability'}}</button><span class="transfer-action-note">Confirm the full reserved quantity is physically available. Contact CDPH/WIC if short.</span></template>
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
 </article>
</template>
<style scoped>
.transfer-shipment:target {outline:2px solid var(--purple);outline-offset:3px;scroll-margin:24px;}
.transfer-shipment {box-sizing:border-box;display:grid;gap:8px;width:100%;max-width:var(--surplus-content-width,1120px);border:1px solid var(--line);padding:12px 16px;border-radius:8px;margin:8px 0;font-size:13px;line-height:1.4;}
.transfer-heading {display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;}
.transfer-title {min-width:0;}
.transfer-title > strong {display:block;font-size:14px;line-height:1.4;}
.transfer-title > span {display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:4px;}
.transfer-title b {font-weight:600;}
.transfer-status {font-size:12px;line-height:1.4;font-weight:600;border:1px solid var(--line);border-radius:12px;padding:2px 8px;white-space:nowrap;}
.transfer-summary {display:grid;grid-template-columns:72px 144px 136px minmax(0,1fr);gap:4px 16px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
.transfer-summary strong {color:var(--text);}
.transfer-expanded {margin:0;}
.transfer-expanded > summary {cursor:pointer;font-size:13px;line-height:1.4;color:var(--muted);width:fit-content;}
.transfer-expanded[open] > summary {margin-bottom:12px;}
.transfer-details {display:grid;grid-template-columns:72px 144px 136px 72px minmax(0,1fr);gap:8px 16px;margin:0;font-size:13px;}
.transfer-label {display:block;color:var(--muted);font-size:12px;line-height:1.4;margin-bottom:4px;font-weight:400;}
.transfer-tracking {min-width:0;overflow-wrap:anywhere;white-space:pre-wrap;}
.transfer-address {margin-top:12px;}
.transfer-address address {font-style:normal;font-size:13px;line-height:1.4;}
.transfer-actions {display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:0;}
.transfer-actions .button {font-size:13px;line-height:1.4;padding:6px 10px;min-height:32px;}
.transfer-actions p {margin:0;font-size:13px;line-height:1.4;}
.transfer-action-note {color:var(--muted);font-size:12px;max-width:360px;}
.transfer-shipment > .text-button {justify-self:start;margin:0;font-size:13px;line-height:1.4;}
.transfer-shipment p {overflow-wrap:anywhere;}
.transfer-expanded > p {margin:12px 0 0;font-size:13px;}
@media(max-width:800px){.transfer-summary{grid-template-columns:repeat(2,minmax(0,1fr));}.transfer-details{grid-template-columns:repeat(2,minmax(0,1fr));}.transfer-tracking{grid-column:1/-1;}}
</style>
