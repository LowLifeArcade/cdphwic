<script setup lang="ts">
import type { ProductRecord } from '~/../shared/domain';

import { createProductEditor, productEditorBody, productEditorFields, productEditorOptions, productEditorOptionLabel } from '~/../shared/productEditor';

const route = useRoute();
const router = useRouter();
const productId = String(route.params.id);
const { data, error: loadError } = await useFetch<{ product: ProductRecord }>(`/api/products/${productId}`);
const product = data.value?.product;
const form = reactive(createProductEditor(product));
const error = ref(loadError.value?.statusMessage ?? '');
const saving = ref(false);
const showDeleteConfirmation = ref(false);
const deleteButton = ref<HTMLButtonElement>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
function cancelDelete() {
    showDeleteConfirmation.value = false;
    nextTick(() => deleteButton.value?.focus());
}
async function deleteProduct() {
    if (!showDeleteConfirmation.value || saving.value) return;
    error.value = '';
    saving.value = true;
    try {
        await $fetch(`/api/products/${productId}`, { method: 'DELETE' });
        await router.push('/products');
    } catch (requestError) {
        const failure = requestError as { data?: { statusMessage?: string }; statusMessage?: string };
        error.value = failure.data?.statusMessage ?? failure.statusMessage ?? 'Product could not be deleted. Please try again.';
    } finally {
        saving.value = false;
    }
}

async function saveProduct() {
    error.value = '';
    saving.value = true;
    try {
        await $fetch(`/api/products/${productId}`, {
            method: 'PUT',
            body: productEditorBody(product!, form),
        });
        await router.push('/products');
    } catch (requestError) {
        const failure = requestError as { data?: { statusMessage?: string }; statusMessage?: string };
        error.value = failure.data?.statusMessage ?? failure.statusMessage ?? 'Product could not be updated.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div
        v-if="error && !product"
        class="notice"
    >
        {{ error }}
    </div>
    <template v-else>
        <div class="page-heading">
            <div>
                <p class="eyebrow">Catalog</p>
                <h1>Edit product</h1>
                <p>Update formula details in the product catalog.</p>
            </div>
            <NuxtLink
                class="button button-ghost"
                to="/products"
                >Cancel</NuxtLink
            >
        </div>

        <form
            class="panel form-panel"
            @submit.prevent="saveProduct"
        >
            <div class="panel-heading">
                <div>
                    <h2>Product details</h2>
                    <span>Changes are saved to the product catalog.</span>
                </div>
            </div>
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
            </div>
            <p
                v-if="error"
                class="form-error"
            >
                {{ error }}
            </p>
            <div class="form-actions">
                <button v-if="identity === 'admin' || identity === 'internal'" ref="deleteButton" class="button button-danger" type="button" :disabled="saving" @click="error = ''; showDeleteConfirmation = true">Delete product</button>
                <NuxtLink
                    class="button button-ghost"
                    to="/products"
                    >Cancel</NuxtLink
                >
                <button
                    class="button button-primary"
                    type="submit"
                    :disabled="saving"
                >
                    {{ saving ? 'Saving…' : 'Save changes' }}
                </button>
            </div>
        </form>
        <ProductDeleteDialog v-if="showDeleteConfirmation" :name="product?.name || 'Unnamed formula'" :product-number="product?.productCode || 'Not specified'" :busy="saving" :error="error" @cancel="cancelDelete" @confirm="deleteProduct" />
    </template>
</template>
