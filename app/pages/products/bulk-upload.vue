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
            Use one row per product. The column order is <code>Formula Description</code>, <code>Manufacturer</code>,
            <code>Formula Name</code>, <code>Formula Form</code>, <code>Flavor</code>, <code>Packaging</code>,
            <code>Product Number</code>, <code>Units Per Case</code>, <code>Yield</code>, <code>Covered by Medi-Cal</code>,
            <code>McKesson PO</code>, <code>McKesson Price</code>, <code>FDA Class</code>, <code>WIC Category</code>,
            <code>S/T</code>, and <code>Infant/Toddler</code>.
            Required headers are Formula Name, Formula Form, Flavor, Product Number, Units Per Case, and Yield; other columns are optional.
            Headers are matched by name, so existing files with a different column order remain supported.
            Cell values may be blank in every column. Completely empty rows are ignored.
            Nonblank Product Numbers must be unique; Formula Name may repeat. Rows without a Product Number get an internal ID and remain unresolved for exact product selection until a number is supplied.
            Formula Form accepts Powder, Liquid Concentrate, Ready-to-Feed (RTF), Other, or blank. Yield is in fluid ounces.
            Use Yes or No for Covered by Medi-Cal. FDA Class choices are Exempt, Non-exempt, and Not infant.
            WIC Category choices are Exempt, Nutritional, Contract, and SNC. S/T choices are Standard and Therapeutic.
            Infant/Toddler choices are Infant, Toddler, and Adult. These details are retained for reporting and staff product selection.
            Format Product Number as text to preserve leading zeroes. Existing internal column headers and WIC Class are also supported.
        </p>
        <div class="upload-example">
            <strong>Example headers</strong>
            <code
                >Formula Description,Manufacturer,Formula Name,Formula Form,Flavor,Packaging,Product Number,Units Per Case,Yield,Covered by Medi-Cal,McKesson PO,McKesson Price,FDA Class,WIC Category,S/T,Infant/Toddler</code
            >
            <code>Example Formula Vanilla 8 oz,Example Manufacturer,Example Formula,Powder,Vanilla,8 oz can,00166806,12,8,Yes,PO-123,31.25,Exempt,Contract,Standard,Infant</code>
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
