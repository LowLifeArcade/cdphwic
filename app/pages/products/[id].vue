<script setup lang="ts">
import type { ProductRecord } from '~/../shared/domain';

type ProductInput = Omit<
    ProductRecord,
    'id' | 'casesRemaining' | 'dollarsApproved' | 'dollarsUsed' | 'dollarsRemaining' | 'yield' | 'mcKessonPrice' | 'coveredByMediCal'
> & { yield?: number | null; mcKessonPrice?: number | null; coveredByMediCal?: boolean | null };

const route = useRoute();
const router = useRouter();
const productId = String(route.params.id);
const { data, error: loadError } = await useFetch<{ product: ProductRecord }>(`/api/products/${productId}`);
const product = data.value?.product;
const form = reactive({
    formulaDescription: product?.formulaDescription ?? '',
    flavor: product?.flavor ?? '',
    packaging: product?.packaging ?? '',
    manufacturer: product?.manufacturer ?? '',
    mcKessonPo: product?.mcKessonPo ?? '',
    mcKessonPrice: product?.mcKessonPrice ?? '',
    coveredByMediCal: product?.coveredByMediCal === undefined ? '' : product.coveredByMediCal ? 'yes' : 'no',
    fdaClass: product?.fdaClass ?? '',
    wicClass: product?.wicClass ?? '',
    st: product?.st ?? '',
    infantToddler: product?.infantToddler ?? '',
    yield: product?.yield ?? '',
    name: product?.name ?? '',
    productId: product?.productId ?? '',
    productCode: product?.productCode ?? '',
    form: product?.form ?? ('powder' as ProductRecord['form']),
    category: product?.category ?? ('standard' as ProductInput['category']),
    unitsPerCase: product?.unitsPerCase ?? '',
    unitPrice: product?.unitPrice ?? '',
    poPrice: product?.poPrice ?? '',
    casesApproved: product?.casesApproved ?? 0,
    casesUsed: product?.casesUsed ?? 0,
    supplierReference: product?.supplierReference ?? '',
    coverage: [...(product?.coverage ?? ['wic'])] as ProductInput['coverage'],
});
const spreadsheetTextFields = [
    { key: 'flavor', label: 'Flavor' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'mcKessonPo', label: 'McKesson PO' },
    { key: 'fdaClass', label: 'FDA Class' },
    { key: 'wicClass', label: 'WIC Class' },
    { key: 'st', label: 'S/T' },
    { key: 'infantToddler', label: 'Infant/Toddler' },
] as const;
function syncMediCalCoverage() {
    if (form.coveredByMediCal === 'yes' && !form.coverage.includes('medical')) form.coverage.push('medical');
    if (form.coveredByMediCal === 'no') form.coverage = form.coverage.filter(value => value !== 'medical');
}
function syncCoverageStatus() {
    form.coveredByMediCal = form.coverage.includes('medical') ? 'yes' : 'no';
}
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

function productBody(): ProductInput {
    return {
        ...product,
        formulaDescription: form.formulaDescription,
        flavor: form.flavor,
        packaging: form.packaging,
        manufacturer: form.manufacturer,
        mcKessonPo: form.mcKessonPo,
        mcKessonPrice: form.mcKessonPrice === '' ? null : Number(form.mcKessonPrice),
        coveredByMediCal: form.coveredByMediCal === '' ? null : form.coveredByMediCal === 'yes',
        fdaClass: form.fdaClass,
        wicClass: form.wicClass,
        st: form.st,
        infantToddler: form.infantToddler,
        yield: form.yield === '' ? null : Number(form.yield),
        name: form.name,
        productId: form.productId,
        productCode: form.productCode,
        form: form.form,
        category: form.category,
        unitsPerCase: form.unitsPerCase === '' ? undefined : Number(form.unitsPerCase),
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
                    <span>Changes are saved to the product catalog.</span>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-field full">
                    <label for="formula-description">Formula Description</label>
                    <textarea id="formula-description" v-model="form.formulaDescription" class="form-textarea" rows="3" />
                </div>
                <div class="form-field">
                    <label for="product-name">Formula Name</label>
                    <input
                        id="product-name"
                        v-model="form.name"
                        class="form-input"
                    />
                </div>
                <div class="form-field">
                    <label for="product-id">Product ID</label>
                    <input
                        id="product-id"
                        v-model="form.productId"
                        class="form-input"
                    />
                </div>
                <div class="form-field">
                    <label for="product-form">Form</label>
                    <select
                        id="product-form"
                        v-model="form.form"
                        class="form-input"
                    >
                        <option value="">Not specified</option>
                        <option value="other">Other</option>
                        <option value="powder">Powder</option>
                        <option value="concentrate">Concentrate</option>
                        <option value="ready-to-feed">Ready to feed</option>
                    </select>
                </div>
                <div class="form-field">
                    <label for="product-code">Product Number</label>
                    <input
                        id="product-code"
                        v-model="form.productCode"
                        class="form-input"
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
                    />
                </div>
                <div v-for="field in spreadsheetTextFields" :key="field.key" class="form-field">
                    <label :for="`product-${field.key}`">{{ field.label }}</label>
                    <input :id="`product-${field.key}`" v-model="form[field.key]" class="form-input" />
                </div>
                <div class="form-field">
                    <label for="product-yield">Yield (fl oz)</label>
                    <input id="product-yield" v-model="form.yield" class="form-input" type="number" min="0" step="any" />
                </div>
                <div class="form-field">
                    <label for="mckesson-price">McKesson Price</label>
                    <input id="mckesson-price" v-model="form.mcKessonPrice" class="form-input" type="number" min="0" step="0.01" />
                </div>
                <div class="form-field">
                    <label for="covered-by-medi-cal">Covered by Medi-Cal</label>
                    <select id="covered-by-medi-cal" v-model="form.coveredByMediCal" class="form-input" @change="syncMediCalCoverage">
                        <option value="">Not specified</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
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
                            @change="syncCoverageStatus"
                        />
                        Medi-Cal
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
