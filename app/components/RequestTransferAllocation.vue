<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import type {SurplusLot} from '~/../shared/surplus';
import type {RequestShipment} from '~/../shared/requestShipments';
import {formatDisplayDate} from '~/../shared/requestPresentation';
const props=defineProps<{lots:SurplusLot[];selections:Array<{row:RequestShipment;index:number}>;agencies:Array<{id:number;name:string}>;busy:boolean;loaded:boolean;loadError:boolean;message?:string}>();
const emit=defineEmits<{select:[lot:SurplusLot,units:number];reserve:[index:number];remove:[index:number];refresh:[]}>();
function agency(id?:number){return props.agencies.find(item=>item.id===id)?.name||`Agency ${id??'—'}`;}
function selection(lot:SurplusLot){return props.selections.find(item=>item.row.sourceLotId===lot.id&&!item.row.transferId);}
</script>
<template>
    <section class="transfer-allocation" aria-label="Other Agency Surplus">
        <div class="transfer-heading"><h4>Other Agency Surplus</h4><button type="button" class="text-button" :disabled="busy" @click="emit('refresh')">Refresh Stock</button></div>
        <p class="muted-copy">Choose transfer units before planning the distributor order. Reserve Stock saves the issuance details and asks the sending agency to confirm availability.</p>
        <p v-if="loadError" role="alert" class="form-error">Unable to load other agency surplus. Refresh Stock to try again.</p>
        <p v-else-if="!loaded" role="status">Loading matching surplus…</p>
        <p v-else-if="!lots.length" class="muted-copy">No matching, available surplus at other agencies.</p>
        <article v-for="lot in lots" :key="lot.id" class="transfer-lot">
            <div class="surplus-lot-info"><strong>{{agency(lot.agencyId)}}</strong><small>{{lot.clinicName||'Clinic not specified'}}</small><small>Exp {{formatDisplayDate(lot.expirationDate)}}</small><span>{{lot.onHand-lot.reserved}} {{unitLabel(lot.onHand-lot.reserved)}} available</span></div>
            <template v-if="!selection(lot)?.row.transferId">
                <label class="field-label">Transfer Units<input type="number" class="form-input" min="0" :max="lot.onHand-lot.reserved" step="1" :value="selection(lot)?.row.unitsToTransfer??0" :disabled="busy" :aria-label="`Transfer units from ${agency(lot.agencyId)}, ${lot.clinicName||'clinic'}, expires ${lot.expirationDate}`" @input="emit('select',lot,Number(($event.target as HTMLInputElement).value))" /></label>
                <button type="button" class="button button-secondary" :disabled="busy||!selection(lot)?.row.unitsToTransfer" @click="emit('reserve',selection(lot)!.index)">Reserve Stock</button>
            </template>
            <span v-else class="muted-copy">Transfer already reserved below.</span>
        </article>
        <div v-if="selections.length" class="selected-transfers">
            <h5>Allocated Transfers</h5>
            <div v-for="item in selections" :key="item.row.transferId||item.row.sourceLotId||item.index" class="allocated-transfer">
                <div><strong>{{item.row.sourceAgencyName||agency(item.row.sourceAgencyId)}}</strong><small>{{item.row.sourceClinicName||'Clinic not specified'}}</small><small>{{item.row.unitsToTransfer??0}} {{unitLabel(item.row.unitsToTransfer??0)}} · {{item.row.transferId?'Reserved — see Shipping for status':'Selected — not reserved'}}</small></div>
                <template v-if="!item.row.transferId"><button type="button" class="text-button" :disabled="busy" @click="emit('remove',item.index)">Remove</button></template>
            </div>
        </div>
        <p v-if="message" class="form-error" role="alert">{{message}}</p>
    </section>
</template>
<style scoped>
.transfer-allocation {margin:18px 0;padding:16px;border:1px solid var(--line);border-radius:10px;}
.transfer-heading {display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.transfer-heading h4,.selected-transfers h5 {margin:0;font-size:1rem;}
.transfer-allocation p {margin:10px 0;font-size:.875rem;}
.transfer-lot,.allocated-transfer {display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line);}
.transfer-lot>div,.allocated-transfer>div {flex:1 1 190px;}
.transfer-lot .surplus-lot-info {display:grid;gap:3px;}
.surplus-lot-info > strong {font-size:14px;line-height:1.4;}
.surplus-lot-info small {display:block;color:var(--muted);font-size:13px;line-height:1.4;margin:0;}
.surplus-lot-info > span {font-size:14px;line-height:1.4;font-weight:600;}
.allocated-transfer small {display:block;margin:3px 0;color:var(--muted);font-size:13px;line-height:1.4;}
.transfer-lot .field-label {width:110px;}
.transfer-lot input {width:100%;}
.selected-transfers {margin-top:14px;}
</style>
