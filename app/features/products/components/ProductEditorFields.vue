<script setup lang="ts">
import {
    productEditorFields,
    productBarcodeFields,
    productEditorOptions,
    productEditorOptionLabel,
    type ProductEditor,
} from '#shared/productEditor';
defineProps<{
    form: ProductEditor;
}>();
</script>

<template>
            <div class="form-grid">
                <div v-for="field in productEditorFields" :key="field.key" class="form-field" :class="{ full: 'type' in field && field.type === 'textarea' }">
                    <label :for="`product-${field.key}`">{{ field.label }}<template v-if="field.key === 'yield'"> (fl oz)</template></label>
                    <textarea v-if="'type' in field && field.type === 'textarea'" :id="`product-${field.key}`" v-model="form[field.key]" class="form-textarea" rows="3" />
                    <select v-else-if="'type' in field && field.type === 'select'" :id="`product-${field.key}`" v-model="form[field.key]" class="form-input">
                        <option v-for="value in productEditorOptions(field, form[field.key])" :key="value" :value="value">{{ productEditorOptionLabel(value) }}</option>
                    </select>
                    <input v-else-if="'type' in field && field.type === 'number'" :id="`product-${field.key}`" v-model="form[field.key]" class="form-input" type="number" :min="field.key === 'unitsPerCase' ? 1 : 0" :step="field.key === 'mcKessonPrice' ? '0.01' : 'any'" />
                    <input v-else :id="`product-${field.key}`" v-model="form[field.key]" class="form-input" type="text" />
                </div>
                <div v-for="field in productBarcodeFields" :key="field.key" class="form-field">
                    <label :for="`product-${field.key}`">{{ field.label }}</label>
                    <input :id="`product-${field.key}`" v-model="form[field.key]" class="form-input" type="text" inputmode="numeric" />
                </div>
            </div>
</template>
