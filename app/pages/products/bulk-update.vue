<script setup lang="ts">
import { productUploadFailure, type ProductUploadIssue } from '~/../shared/productUploadErrors';
const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const error = ref('');
const issues = ref<ProductUploadIssue[]>([]);
const uploading = ref(false);

async function updateProducts() {
    issues.value = [];
    const file = fileInput.value?.files?.[0];
    if (!file) {
        error.value = 'Choose a CSV or Excel file first.';
        return;
    }

    error.value = '';
    uploading.value = true;
    const body = new FormData();
    body.append('file', file);
    try {
        await $fetch('/api/products/bulk-update', {
            method: 'POST',
            body,
        });
        await router.push('/products');
    } catch (requestError) {
        const failure = productUploadFailure(requestError);
        error.value = failure.message;
        issues.value = failure.issues;
    } finally {
        uploading.value = false;
    }
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Bulk update products</h1>
            <p>Update product details and quantities for existing catalog products.</p>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/products"
            >Cancel</NuxtLink
        >
    </div>

    <section class="panel form-panel">
        <div class="panel-heading">
            <div>
                <h2>Upload product updates</h2>
                <span>CSV, XLS, or XLSX</span>
            </div>
        </div>
        <p class="muted-copy">
            Include <code>Product Number</code> to identify each existing product (legacy <code>productId</code> is also accepted).
            Add only the columns you want to update. Omitted columns remain unchanged; included blank cells clear their values.
            Product fields follow this order in the formula editor: <code>Formula Description</code>, <code>Manufacturer</code>,
            <code>Formula Name</code>, <code>Formula Form</code>, <code>Flavor</code>, <code>Packaging</code>, <code>Product Number</code>,
            <code>Units Per Case</code>, <code>Yield</code>, <code>Covered by Medi-Cal</code>, <code>McKesson PO</code>, <code>McKesson Price</code>,
            <code>FDA Class</code>, <code>WIC Category</code>, <code>S/T</code>, and <code>Infant/Toddler</code>.
            Headers may appear in any order. WIC Class remains accepted for older files.
            FDA Class choices are Exempt, Non-exempt, and Not infant; WIC Category choices are Exempt, Nutritional, Contract, and SNC;
            S/T choices are Standard and Therapeutic; Infant/Toddler choices are Infant, Toddler, and Adult.
            Legacy Cases Approved, Cases Used, Unit Price, PO Price, Supplier Reference, and Coverage columns remain supported.
            Product Numbers must already exist. No updates are saved if any row is invalid.
        </p>
        <div class="upload-example">
            <strong>Example headers</strong>
            <code>Product Number,Manufacturer,McKesson Price,Packaging</code>
            <code>166802,Example Manufacturer,42.50,6 cans per case</code>
        </div>
        <div class="upload-drop">
            <input
                ref="fileInput"
                type="file"
                accept=".csv,.xls,.xlsx"
            />
            <span>Use one update row per product. Format Product Number as text to preserve leading zeroes.</span>
        </div>
        <ProductUploadErrors :message="error" :issues="issues" />
        <div class="form-actions">
            <NuxtLink
                class="button button-ghost"
                to="/products"
                >Cancel</NuxtLink
            >
            <button
                class="button button-primary"
                type="button"
                :disabled="uploading"
                @click="updateProducts"
            >
                {{ uploading ? 'Updating…' : 'Update products' }}
            </button>
        </div>
    </section>
</template>
