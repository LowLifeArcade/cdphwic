<script setup lang="ts">
import { productUploadFailure, type ProductUploadIssue } from '~/../shared/productUploadErrors';
const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const error = ref('');
const issues = ref<ProductUploadIssue[]>([]);
const message = ref('');
const uploading = ref(false);

async function uploadProducts() {
    issues.value = [];
    const file = fileInput.value?.files?.[0];
    if (!file) {
        error.value = 'Choose a CSV or Excel file first.';
        return;
    }

    error.value = '';
    message.value = '';
    uploading.value = true;
    const body = new FormData();
    body.append('file', file);
    try {
        const result = await $fetch<{ count: number }>('/api/products/bulk', {
            method: 'POST',
            body,
        });
        message.value = `${result.count} product${result.count === 1 ? '' : 's'} added.`;
        if (fileInput.value) {
            fileInput.value.value = '';
        }
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
            <h1>Bulk upload products</h1>
            <p>Upload a CSV or Excel sheet with one product per row.</p>
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
                <h2>Upload catalog file</h2>
                <span>CSV, XLS, or XLSX</span>
            </div>
        </div>
        <p class="muted-copy">
            Use one row per product. Required headers are <code>Formula Name</code>, <code>Formula Form</code>,
            <code>Flavor</code>, <code>Product Number</code>, <code>Units Per Case</code>, and <code>Yield</code>.
            Cell values may be blank in every column. Completely empty rows are ignored.
            Nonblank Product Numbers must be unique; Formula Name may repeat. Rows without a Product Number get an internal ID and remain unresolved for exact product selection until a number is supplied.
            Formula Form accepts Powder, Liquid Concentrate, Ready-to-Feed (RTF), Other, or blank. Yield is in fluid ounces.
            Optional columns are <code>Formula Description</code>, <code>Manufacturer</code>, <code>McKesson PO</code>,
            <code>McKesson Price</code>, <code>Covered by Medi-Cal</code>, <code>FDA Class</code>, <code>WIC Category</code>,
            <code>S/T</code>, <code>Infant/Toddler</code>, and <code>Packaging</code>.
            Use Yes or No for Covered by Medi-Cal. These details are retained for reporting and staff product selection.
            Format Product Number as text to preserve leading zeroes. Existing internal column headers are also supported.
        </p>
        <div class="upload-example">
            <strong>Example headers</strong>
            <code
                >Formula Name,Formula Form,Flavor,Product Number,Units Per Case,Yield,Formula Description,Manufacturer,McKesson PO,McKesson Price,Covered by Medi-Cal,FDA Class,WIC Category,S/T,Infant/Toddler,Packaging</code
            >
            <code>Example Formula,Powder,Vanilla,00166806,12,8,Example Formula Vanilla 8 oz,Example Manufacturer,PO-123,31.25,Yes,Exempt,A,S,Toddler,8 oz can</code>
        </div>
        <div class="upload-drop">
            <input
                ref="fileInput"
                type="file"
                accept=".csv,.xls,.xlsx"
            />
            <span>Existing Product Numbers are rejected. No products are added if any row is invalid.</span>
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
                @click="uploadProducts"
            >
                {{ uploading ? 'Uploading…' : 'Upload products' }}
            </button>
        </div>
        <p
            v-if="message"
            class="success-copy"
        >
            {{ message }}
        </p>
    </section>
</template>
