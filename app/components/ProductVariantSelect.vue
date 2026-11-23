<script setup lang="ts">
import type { ProductRecord } from '../../shared/domain';
defineProps<{
    identity: 'admin' | 'internal' | 'agency';
    products: ProductRecord[];
    modelValue?: string;
    disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
    <label v-if="identity === 'admin' || identity === 'internal'" class="field-label">
        Exact Product
        <select class="form-input" :value="modelValue ?? ''" :disabled="disabled" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
            <option value="">Select exact product</option>
            <option v-for="product in products" :key="product.productCode" :value="product.productCode">
                {{ product.formulaDescription || product.name }} · {{ product.flavor || 'Unflavored' }} · {{ product.packaging || 'Packaging not specified' }} · {{ product.productCode }}
            </option>
        </select>
        <small v-if="!products.length">No matching catalog product. Product details can be entered below.</small>
        <small v-else-if="products.length > 1 && !modelValue">Select a Product Number to populate the correct product details.</small>
    </label>
</template>
