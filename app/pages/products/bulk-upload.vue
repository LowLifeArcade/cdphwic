<script setup lang="ts">
const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const error = ref('');
const message = ref('');
const uploading = ref(false);

async function uploadProducts() {
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
        error.value = (requestError as { statusMessage?: string }).statusMessage ?? 'Products could not be uploaded.';
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
            Use one row per product. Required columns are <code>productId</code>, <code>productCode</code>,
            <code>name</code>, <code>form</code>, <code>category</code>, and <code>unitsPerCase</code>. Optional columns
            are <code>unitPrice</code>, <code>poPrice</code>, <code>casesApproved</code>, <code>casesUsed</code>,
            <code>supplierReference</code>, and <code>coverage</code>. Use <code>powder</code>,
            <code>concentrate</code>, or <code>ready-to-feed</code> for form.
        </p>
        <div class="upload-example">
            <strong>Example headers</strong>
            <code
                >productId,productCode,name,form,category,unitsPerCase,unitPrice,poPrice,casesApproved,casesUsed,supplierReference,coverage</code
            >
            <code>PROD-305,166806,Example Formula,powder,standard,12,31.25,31.25,100,0,EXAMPLE-305,wic</code>
        </div>
        <div class="upload-drop">
            <input
                ref="fileInput"
                type="file"
                accept=".csv,.xls,.xlsx"
            />
            <span>Existing product names are rejected.</span>
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
