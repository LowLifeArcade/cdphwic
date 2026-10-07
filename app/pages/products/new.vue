<script setup lang="ts">
import type { ProductForm, ProductRecord } from '~/../shared/domain';

type ProductInput = Omit<ProductRecord, 'id'>;

const router = useRouter();
const form = reactive({
    name: '',
    productId: '',
    productCode: '',
    form: 'powder' as ProductForm,
    category: 'standard' as ProductInput['category'],
    unitsPerCase: '',
    unitPrice: '',
    supplierReference: '',
    coverage: ['wic'] as ProductInput['coverage'],
});
const error = ref('');
const saving = ref(false);

function productBody(): ProductInput {
    return {
        name: form.name,
        productId: form.productId,
        productCode: form.productCode,
        form: form.form,
        category: form.category,
        unitsPerCase: Number(form.unitsPerCase),
        unitPrice: form.unitPrice === '' ? undefined : Number(form.unitPrice),
        supplierReference: form.supplierReference,
        coverage: form.coverage,
    };
}

async function addProduct() {
    error.value = '';
    saving.value = true;
    try {
        await $fetch('/api/products', {
            method: 'POST',
            body: productBody(),
        });
        await router.push('/products');
    } catch (requestError) {
        error.value = (requestError as { statusMessage?: string }).statusMessage ?? 'Product could not be added.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Add product</h1>
            <p>Add one product to the catalog.</p>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/products"
            >Cancel</NuxtLink
        >
    </div>

    <form
        class="panel form-panel"
        @submit.prevent="addProduct"
    >
        <div class="panel-heading">
            <div>
                <h2>Product details</h2>
                <span>All fields are saved to the demo catalog.</span>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-field">
                <label for="product-name">Name</label>
                <input
                    id="product-name"
                    v-model="form.name"
                    class="form-input"
                    required
                />
            </div>
            <div class="form-field">
                <label for="product-id">Product ID</label>
                <input
                    id="product-id"
                    v-model="form.productId"
                    class="form-input"
                    placeholder="Supplier product code"
                    required
                />
            </div>
            <div class="form-field">
                <label for="product-form">Form</label>
                <select
                    id="product-form"
                    v-model="form.form"
                    class="form-input"
                    required
                >
                    <option value="powder">Powder</option>
                    <option value="concentrate">Concentrate</option>
                    <option value="ready-to-feed">Ready to feed</option>
                </select>
            </div>
            <div class="form-field">
                <label for="product-code">Product code</label>
                <input
                    id="product-code"
                    v-model="form.productCode"
                    class="form-input"
                    placeholder="Catalog or supplier code"
                    required
                />
            </div>
            <div class="form-field">
                <label for="product-category">Category</label>
                <select
                    id="product-category"
                    v-model="form.category"
                    class="form-input"
                >
                    <option value="standard">Standard</option>
                    <option value="exempt">Exempt</option>
                    <option value="nutritional">Nutritional</option>
                </select>
            </div>
            <div class="form-field">
                <label for="units-per-case">Units per case</label>
                <input
                    id="units-per-case"
                    v-model="form.unitsPerCase"
                    class="form-input"
                    type="number"
                    min="1"
                    required
                />
            </div>
            <div class="form-field">
                <label for="unit-price">Unit price</label>
                <input
                    id="unit-price"
                    v-model="form.unitPrice"
                    class="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                />
            </div>
            <div class="form-field full">
                <label for="supplier-reference">Supplier reference</label>
                <input
                    id="supplier-reference"
                    v-model="form.supplierReference"
                    class="form-input"
                />
            </div>
            <fieldset class="form-field full coverage-field">
                <legend>Coverage</legend>
                <label>
                    <input
                        v-model="form.coverage"
                        type="checkbox"
                        value="wic"
                    />
                    WIC
                </label>
                <label>
                    <input
                        v-model="form.coverage"
                        type="checkbox"
                        value="medical"
                    />
                    Medical
                </label>
            </fieldset>
        </div>
        <p
            v-if="error"
            class="form-error"
        >
            {{ error }}
        </p>
        <div class="form-actions">
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
                {{ saving ? 'Saving…' : 'Add product' }}
            </button>
        </div>
    </form>
</template>
