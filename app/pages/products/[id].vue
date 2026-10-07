<script setup lang="ts">
import type { ProductForm, ProductRecord } from '~/../shared/domain';

type ProductInput = Omit<
    ProductRecord,
    'id' | 'casesRemaining' | 'dollarsApproved' | 'dollarsUsed' | 'dollarsRemaining'
>;

const route = useRoute();
const router = useRouter();
const productId = String(route.params.id);
const { data, error: loadError } = await useFetch<{ product: ProductRecord }>(`/api/products/${productId}`);
const product = data.value?.product;
const form = reactive({
    name: product?.name ?? '',
    productId: product?.productId ?? '',
    productCode: product?.productCode ?? '',
    form: product?.form ?? ('powder' as ProductForm),
    category: product?.category ?? ('standard' as ProductInput['category']),
    unitsPerCase: product?.unitsPerCase ?? 0,
    unitPrice: product?.unitPrice ?? '',
    poPrice: product?.poPrice ?? '',
    casesApproved: product?.casesApproved ?? 0,
    casesUsed: product?.casesUsed ?? 0,
    supplierReference: product?.supplierReference ?? '',
    coverage: [...(product?.coverage ?? ['wic'])] as ProductInput['coverage'],
});
const error = ref(loadError.value?.statusMessage ?? '');
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
        poPrice: form.poPrice === '' ? undefined : Number(form.poPrice),
        casesApproved: Number(form.casesApproved),
        casesUsed: Number(form.casesUsed),
        supplierReference: form.supplierReference,
        coverage: form.coverage,
    };
}

async function saveProduct() {
    error.value = '';
    saving.value = true;
    try {
        await $fetch(`/api/products/${productId}`, {
            method: 'PUT',
            body: productBody(),
        });
        await router.push('/products');
    } catch (requestError) {
        error.value = (requestError as { statusMessage?: string }).statusMessage ?? 'Product could not be updated.';
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
                <p>Update product details, coverage, and inventory quantities.</p>
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
                    <span>Changes are saved to the demo catalog.</span>
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
                <div class="form-field">
                    <label for="po-price">PO price</label>
                    <input
                        id="po-price"
                        v-model="form.poPrice"
                        class="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                    />
                </div>
                <div class="form-field">
                    <label for="cases-approved">Cases approved</label>
                    <input
                        id="cases-approved"
                        v-model="form.casesApproved"
                        class="form-input"
                        type="number"
                        min="0"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="cases-used">Cases used</label>
                    <input
                        id="cases-used"
                        v-model="form.casesUsed"
                        class="form-input"
                        type="number"
                        min="0"
                        required
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
                    {{ saving ? 'Saving…' : 'Save changes' }}
                </button>
            </div>
        </form>
    </template>
</template>
