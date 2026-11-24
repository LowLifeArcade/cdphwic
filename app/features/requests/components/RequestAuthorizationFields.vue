<script setup lang="ts">
import type { ProductRecord, RequestRecord } from '#shared/domain';
import type { FormulaAuthorization } from '#shared/formulaAuthorizations';
import { isMcKessonPo } from '#shared/mckessonPo';
import { catalogPoCasesRemaining } from '#shared/catalogOrderDefaults';
import { formulaFormLabel } from '#shared/requestPresentation';
import { formulaOrders } from '#shared/formulaOrders';
import { useAuthorizationEditor } from '../composables/useAuthorizationEditor';
const props = defineProps<{
    draft: Partial<RequestRecord>;
    request: RequestRecord;
    authorization: FormulaAuthorization;
    formulaIndex: number;
    products?: ProductRecord[];
    identity: 'admin' | 'internal' | 'agency';
    saving: boolean;
    splitOrderTypesEnabled: boolean;
}>();
const emit = defineEmits<{
    changeOrder: [index: number, value: string];
}>();
const {
    authorizationProducts,
    chooseAuthorizationProduct,
    authorizationProduct,
    enterProductNumber,
    recalculateCasesFromUnitsToOrder,
    canAddIssuanceMonth,
    addBenefitMonth,
    updateFollowingIssuanceMonths,
    issuanceMonthOptions,
    recalculateAuthorizationCases,
    removeBenefitMonth,
    updateUnitsToOrder,
} = useAuthorizationEditor(
    props.draft,
    () => props.products,
    () => props.request,
);
</script>

<template>
            <label v-if="!splitOrderTypesEnabled && formulaOrders(request)[formulaIndex]" class="field-label formula-order-type">Order Type
                <select class="form-input" :value="(draft.formulaOrders?.[formulaIndex]?.specialOrder ?? formulaOrders(request)[formulaIndex]!.specialOrder)?'special':'standard'" :aria-label="`Formula ${formulaIndex+1} Order Type`" :disabled="saving" @change="emit('changeOrder', formulaIndex, ($event.target as HTMLSelectElement).value)">
                    <option value="standard">Standard</option><option value="special">Special Order</option>
                </select>
            </label>
            <ProductVariantSelect :identity="identity" :products="authorizationProducts(authorization)" :model-value="authorization.productCode" :disabled="saving" @update:model-value="chooseAuthorizationProduct(formulaIndex,$event)" />
            <p v-if="identity==='admin' || identity==='internal'" class="muted-copy catalog-product-help">If the exact product is not listed, <NuxtLink to="/products/new">add it on the Products page</NuxtLink>, then return here to select it.</p>
            <p v-if="authorizationProduct(authorization) && !isMcKessonPo(authorizationProduct(authorization)?.mcKessonPo)" class="muted-copy" role="status">Catalog cases remaining: <strong>{{catalogPoCasesRemaining(authorizationProduct(authorization)) ?? 'Not available'}}</strong></p>
            <div class="detail-grid cdph-product-details">
                <label class="field-label">Formula Name<input v-model="authorization.formulaName" class="form-input" :placeholder="authorization.productName" /></label>
                <div><span>Form</span><strong>{{formulaFormLabel(authorizationProduct(authorization)?.form === 'other' ? authorization.productForm : authorizationProduct(authorization)?.form || authorization.productForm)}}</strong></div>
                <div><span>Flavor</span><strong>{{authorizationProduct(authorization)?.flavor || authorization.flavor || '—'}}</strong></div>
                <div><span>Packaging</span><strong>{{authorizationProduct(authorization)?.packaging || '—'}}</strong></div>
                <label class="field-label">Product Number<input v-model="authorization.productCode" class="form-input" @change="enterProductNumber(formulaIndex,authorization.productCode ?? '')" :placeholder="authorizationProduct(authorization)?.productCode ?? 'Enter product number'" /></label>
                <label class="field-label">Units Per Case<input v-model.number="authorization.unitsPerCase" class="form-input" type="number" min="1" step="1" :placeholder="String(authorizationProduct(authorization)?.unitsPerCase ?? '')" @input="recalculateCasesFromUnitsToOrder(formulaIndex)" /></label>
                <label class="field-label">Yield (fl oz)<input v-model.number="authorization.yield" class="form-input" type="number" min="0" step="any" :placeholder="String(authorizationProduct(authorization)?.yield ?? '')" /></label>
            </div>
            <div class="benefit-allocation-editor">
                <div class="issuance-row-heading">
                    <h4>Select Month and Quantity</h4>
                    <button class="text-button" type="button" :disabled="authorization.benefitIssuances.some(row=>!row.month) || !canAddIssuanceMonth(authorization)" @click="addBenefitMonth(formulaIndex)">+ Add issuance month</button>
                </div>
                <div v-for="(issuance, index) in authorization.benefitIssuances" :key="`${issuance.month}-${index}`" class="month-row">
                    <select v-model="issuance.month" class="form-input month-select" :aria-label="`Formula ${formulaIndex+1} issuance month ${index+1}`" @change="updateFollowingIssuanceMonths(formulaIndex,index)">
                        <option value="">Select month</option>
                        <option v-for="month in issuanceMonthOptions(authorization)" :key="month.value" :value="month.value" :disabled="index>0 && (!authorization.benefitIssuances[index-1]?.month || month.value<=authorization.benefitIssuances[index-1]!.month)">{{ month.label }}</option>
                    </select>
                    <div class="quantity-input">
                        <input v-model.number="issuance.quantity" class="form-input month-quantity" type="number" inputmode="numeric" min="1" placeholder="Quantity" :aria-label="`Formula ${formulaIndex+1} issuance quantity ${index+1}`" @input="recalculateAuthorizationCases(formulaIndex)" />
                        <span>Units</span>
                    </div>
                    <button class="icon-button" type="button" aria-label="Remove benefit month" @click="removeBenefitMonth(formulaIndex,index)">×</button>
                </div>
            </div>
            <div class="form-grid issuance-total-units">
                <label class="field-label">Total Units Approved<input v-model.number="authorization.totalUnitsIssued" class="form-input authorization-number" type="number" inputmode="numeric" min="0" step="1" :aria-label="`Formula ${formulaIndex+1} Total Units Approved`" @input="updateUnitsToOrder(formulaIndex)" /></label>
            </div>
</template>

<style scoped>
.formula-order-type {max-width:260px;margin:0 0 12px;}
</style>
