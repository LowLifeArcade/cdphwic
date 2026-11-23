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
        <small v-if="!products.length">No matching catalog product. Enter a Product Number to search the catalog, or enter product details below.</small>
        <small v-else-if="products.length > 1 && !modelValue">Select an exact product from the candidates to populate its details.</small>
    </label>
</template>
