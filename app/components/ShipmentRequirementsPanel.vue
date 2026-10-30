<script setup lang="ts">
import type {RequestShipment} from '~/../shared/requestShipments';
defineProps<{shipment:RequestShipment}>();
</script>
<template>
 <div class="shipment-requirements"><strong>{{shipment.shipmentSource==='agency'?'Agency Transfer Damage Instructions':'Distributor Damage Requirements'}}</strong>
 <p v-if="shipment.shipmentSource==='agency'">Record missing or damaged quantities and describe the condition. Attach images to help CDPH/WIC coordinate follow-up with the sending agency.</p>
 <template v-else-if="shipment.distributorPolicy"><p>{{shipment.distributorPolicy.distributorName}} · Replacement: {{shipment.distributorPolicy.replacementBasis==='units'?'Individual cans/cartons':'Whole case'}}</p><p>For damaged product: Labels {{shipment.distributorPolicy.labelsRequired?'required':'not required'}} · Images {{shipment.distributorPolicy.imagesRequired?'required':'not required'}}</p><p v-if="shipment.distributorPolicy.instructions" class="instructions">{{shipment.distributorPolicy.instructions}}</p></template>
 <p v-else class="muted-copy">Distributor damage requirements have not been specified. Contact CDPH/WIC for instructions.</p>
 </div>
</template>
<style scoped>.shipment-requirements{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:8px;font-size:14px}.shipment-requirements p{margin:8px 0}.instructions{white-space:pre-wrap}</style>
