<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import {clinicStreetAddressLines,type ClinicAddress} from '~/../shared/shipping';
import type {SurplusTransfer} from '~/../shared/surplus';
import {formatEtaDate as formatDisplayDate} from '~/../shared/requestPresentation';
const props=defineProps<{transfer:SurplusTransfer;canShip:boolean;sourceName:string;destinationName:string}>();
const emit=defineEmits<{updated:[]}>();
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const busy=ref(false);const error=ref('');
const labelsReady=ref(false);
const requestedLabelCount=ref<number|null>(null);
const availabilityResponse = ref('');
async function sendAvailabilityResponse() {
    const message = availabilityResponse.value.trim();
    if (!message || busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        await $fetch(`/api/request-transfers/${props.transfer.id}/availability-response`, {
            method: 'POST', headers: { 'x-demo-user': identity.value }, body: { message },
        });
        availabilityResponse.value = '';
        emit('updated');
        window.dispatchEvent(new Event('request-messages-changed'));
    } catch (e) {
        error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'The response could not be sent.';
    } finally {
        busy.value = false;
    }
}
const route=useRoute();
async function confirmStock(){if(!Number.isSafeInteger(requestedLabelCount.value)||!requestedLabelCount.value||requestedLabelCount.value<1)return;busy.value=true;error.value='';try{await $fetch(`/api/request-transfers/${props.transfer.id}/confirm-stock`,{method:'POST',headers:{'x-demo-user':identity.value},body:{requestedLabelCount:requestedLabelCount.value}});emit('updated');window.dispatchEvent(new Event('request-messages-changed'));}catch(e){error.value=(e as any).data?.statusMessage??'Product availability could not be confirmed.';}finally{busy.value=false;}}
const transferStatusLabel = computed(() => {
    const transfer = props.transfer;
    switch (transfer.status) {
        case 'reserved':
            if (!transfer.stock_confirmed_at) return 'Awaiting Stock Confirmation';
            if (transfer.eta && transfer.tracking_reference) return 'Pending Pickup Confirmation';
            return labelsReady.value ? 'Awaiting Shipping Details' : 'Awaiting Shipping Labels';
        case 'shipped': return 'In Transit';
        case 'received': return 'Confirmed Receipt';
        case 'cancelled': return 'Cancelled';
        default: return 'Blocked — expired';
    }
});
const senderAction = computed(() => {
    const transfer = props.transfer;
    if (!props.canShip || transfer.status !== 'reserved') return '';
    if (!transfer.stock_confirmed_at) return 'Confirm Product Availability';
    if (transfer.eta && transfer.tracking_reference) return 'Print Labels & Confirm Pickup';
    return '';
});
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
   <span v-if="senderAction" class="sender-action-summary">
    <span class="sender-action-badge">Action needed</span>
    <span><strong>{{ senderAction }}</strong><small>{{ transferStatusLabel }}</small></span>
   </span>
   <span v-else class="transfer-status" :class="{ 'shipment-transit-status': transfer.status === 'shipped', 'transfer-status-pending': transfer.status === 'reserved' }">{{ transferStatusLabel }}</span>
   <span class="transfer-collapsed-quantity">{{transfer.quantity}} {{unitLabel(transfer.quantity)}}</span>
  </summary>
  <div class="transfer-expanded-content">
  <section class="transfer-read-only" aria-label="Transfer details">
  <h4>Transfer Details</h4>
  <p v-if="transfer.request_id" class="transfer-request-reference">Request #{{transfer.request_id}}</p>
  <div class="transfer-details">
   <div><span class="transfer-label">Units</span><strong>{{transfer.quantity}}</strong></div>
   <div><span class="transfer-label">Expiration Date</span><span>{{formatDisplayDate(transfer.expiration_date)}}</span></div>
   <div><span class="transfer-label">ETA</span><span>{{visibleEta ? formatDisplayDate(visibleEta) : 'Pending GSO pickup'}}</span></div>
   <div v-if="transfer.stock_confirmed_at"><span class="transfer-label">Carrier</span><span>GSO</span></div>
   <div v-if="transfer.stock_confirmed_at" class="transfer-tracking"><span class="transfer-label">Tracking Numbers</span><span>{{transfer.tracking_reference || 'Pending CDPH/WIC shipping details'}}</span></div>
   <div v-if="transfer.requested_label_count"><span class="transfer-label">Shipping Labels Requested</span><span>{{transfer.requested_label_count}}</span></div>
  </div>
  <div class="transfer-address"><span class="transfer-label">Sending Agency</span><address><strong>{{ sourceName }}</strong><br />{{transfer.source_clinic_name || pickup?.clinicName || 'Clinic not specified'}}<template v-if="pickup"><template v-for="(line, lineIndex) in clinicStreetAddressLines(pickup)" :key="lineIndex"><br />{{ line }}</template></template></address></div>
  <div class="transfer-address">
   <span class="transfer-label">Shipping Address</span>
   <address v-if="destination">{{destinationName}}<template v-if="destination.attention"><br />Attn: {{destination.attention}}</template><br />{{destination.addressLine1}}<template v-if="destination.addressLine2"><br />{{destination.addressLine2}}</template><br />{{destination.city}}, {{destination.state}} {{destination.postalCode}}</address>
   <span v-else class="transfer-label">Shipping address has not been provided.</span>
  </div>
  <p v-if="transfer.stock_confirmed_at" class="pickup-confirmed" role="status">✓ Sending agency confirmed stock {{formatDisplayDate(transfer.stock_confirmed_at)}}</p>
  <p v-if="(transfer.status==='shipped'||transfer.status==='received') && transfer.shipped_date" class="pickup-confirmed" role="status">✓ Pickup confirmed {{formatDisplayDate(transfer.shipped_date)}}</p>
  </section>
  <section v-if="transfer.status === 'reserved' || transfer.stock_confirmed_at || (!canShip && identity !== 'agency') || error" class="transfer-action-panel" aria-label="Transfer actions">
  <h4>Transfer Actions</h4>
  <TransferShippingLabels v-if="transfer.stock_confirmed_at" :transfer-id="transfer.id" :can-upload="false" @ready="labelsReady=$event" />
  <TransferPickupInstructions v-if="canShip && transfer.status==='reserved' && transfer.stock_confirmed_at && labelsReady && transfer.eta && transfer.tracking_reference" />
  <div v-if="transfer.availability_response" class="transfer-response-record">
    <strong>Response to CDPH/WIC</strong>
    <p>{{ transfer.availability_response }}</p>
  </div>
  <div v-if="transfer.status==='reserved'" class="transfer-actions">
   <template v-if="!transfer.stock_confirmed_at">
    <div v-if="canShip" class="transfer-stock-confirmation">
        <p class="transfer-action-note">Confirm that you have the full reserved quantity. Contact CDPH/WIC if you’re short.</p>
        <div class="transfer-response">
            <label class="field-label">Response to CDPH/WIC
                <textarea v-model="availabilityResponse" class="form-textarea" rows="2" maxlength="1000" :disabled="busy" placeholder="Explain any shortage or availability issue." />
            </label>
            <button class="button button-ghost" type="button" :disabled="busy || !availabilityResponse.trim()" @click="sendAvailabilityResponse">Send Response</button>
        </div>
        <div class="transfer-stock-confirmation-controls">
            <label class="field-label label-count-field">
                Shipping Labels Needed
                <input v-model.number="requestedLabelCount" class="form-input" type="number" min="1" step="1" inputmode="numeric" :disabled="busy" :aria-label="`Transfer ${transfer.id} number of shipping labels needed`" />
            </label>
            <button class="button button-secondary" type="button" :disabled="busy || !Number.isSafeInteger(requestedLabelCount) || !requestedLabelCount || requestedLabelCount < 1" @click="confirmStock">{{ busy ? 'Saving…' : 'Confirm Product Availability' }}</button>
        </div>
    </div>
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
  </section>
  </div>
 </details>
</template>
<style scoped>
.transfer-shipment:target {outline:2px solid var(--purple);outline-offset:3px;scroll-margin:24px;}
.transfer-shipment {box-sizing:border-box;display:block;width:100%;max-width:var(--surplus-content-width,1120px);border:1px solid var(--line);padding:0 16px;border-radius:8px;margin:8px 0;font-size:13px;line-height:1.4;}
.transfer-shipment.transfer-cancelled {background:var(--surface-raised);border-color:var(--line);color:var(--muted);}
.transfer-shipment.transfer-cancelled .transfer-status {display:inline-flex;align-items:center;padding:2px 8px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised);color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap;}
.sender-action-summary {display:flex;align-items:center;flex-wrap:wrap;gap:5px 8px;}
.sender-action-summary small {display:block;color:var(--muted);font-size:12px;}
.sender-action-badge {
    padding:2px 8px;
    border-radius:999px;
    background:light-dark(#ffedbd,#4e3406);
    color:light-dark(#633900,#ffe0a3);
    font-weight:750;
    white-space:nowrap;
}
.transfer-status-pending {display:inline-block;padding:2px 8px;border:1px solid var(--line);border-radius:12px;color:light-dark(#774700,#ffcf7a);font-weight:650;}
.transfer-collapsed-summary {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;padding:12px 0;cursor:pointer;list-style:none;}
.transfer-collapsed-summary::-webkit-details-marker {display:none;}
.transfer-collapsed-summary::after {content:'Details';color:var(--muted);font-size:12px;}
.transfer-shipment[open] > .transfer-collapsed-summary::after {content:'Hide details';}
.transfer-collapsed-title {display:grid;gap:3px;min-width:180px;flex:1;}
.transfer-collapsed-title strong {font-size:14px;}
.transfer-collapsed-title small {font-size:12px;color:var(--muted);}
.transfer-collapsed-quantity {font-size:13px;font-weight:650;white-space:nowrap;}
.transfer-expanded-content {display:grid;gap:8px;padding:0 0 12px;}
.transfer-read-only {display:grid;gap:8px;}
.transfer-read-only h4,.transfer-action-panel h4 {margin:0;font-size:14px;font-weight:700;}
.transfer-action-panel {
    display:grid;
    gap:10px;
    margin-top:8px;
    padding:12px;
    border:1px solid var(--line);
    border-radius:8px;
    background:var(--surface-raised);
}
.transfer-action-panel > .text-button {justify-self:start;}
.transfer-read-only > p,.transfer-action-panel > p {margin:0;}
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
.transfer-stock-confirmation {display:grid;gap:8px;padding:0 0 12px;}
.transfer-response {display:grid;justify-items:start;gap:6px;max-width:36rem;}
.transfer-response .field-label {width:100%;margin:0;}
.transfer-response-record {padding:8px 10px;border-left:3px solid var(--purple);}
.transfer-response-record p {margin:4px 0 0;white-space:pre-wrap;}
.transfer-stock-confirmation-controls {display:flex;align-items:end;flex-wrap:wrap;gap:8px 12px;}
.transfer-stock-confirmation-controls .field-label {margin:0;}
.label-count-field {min-width:0;}
.label-count-field .form-input {box-sizing:border-box;width:5rem;max-width:100%;justify-self:start;}
.transfer-shipment p {overflow-wrap:anywhere;}
@media(max-width:800px){.transfer-details{grid-template-columns:repeat(2,minmax(0,1fr));}.transfer-tracking{grid-column:1/-1;}}
</style>
