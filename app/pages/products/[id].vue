<script setup lang="ts">
import type { ProductRecord } from '~/../shared/domain';

import { createProductEditor, productEditorBody } from '~/../shared/productEditor';
import ProductEditorFields from '~/features/products/components/ProductEditorFields.vue';
import { useProductMutation } from '~/features/products/composables/useProductMutation';

const route = useRoute();
const router = useRouter();
const productId = String(route.params.id);
const { data, error: loadError } = await useFetch<{ product: ProductRecord }>(`/api/products/${productId}`);
const product = data.value?.product;
const form = reactive(createProductEditor(product));
const { error, saving, run } = useProductMutation(loadError.value?.statusMessage ?? '');
const showDeleteConfirmation = ref(false);
const deleteButton = ref<HTMLButtonElement>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
function cancelDelete() {
    showDeleteConfirmation.value = false;
    nextTick(() => deleteButton.value?.focus());
}
async function deleteProduct() {
    if (!showDeleteConfirmation.value || saving.value) return;
    await run(async () => {
        await $fetch(`/api/products/${productId}`, { method: 'DELETE' });
        await router.push('/products');
    }, 'Product could not be deleted. Please try again.');
}

async function saveProduct() {
    await run(async () => {
        await $fetch(`/api/products/${productId}`, {
            method: 'PUT',
            body: productEditorBody(product!, form),
        });
        await router.push('/products');
    }, 'Product could not be updated.');
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
            <ProductEditorFields :form="form" />
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
