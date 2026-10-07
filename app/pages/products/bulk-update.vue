<script setup lang="ts">
const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const error = ref('');
const uploading = ref(false);

async function updateProducts() {
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
        error.value = (requestError as { statusMessage?: string }).statusMessage ?? 'Products could not be updated.';
    } finally {
        uploading.value = false;
    }
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Bulk update quantities</h1>
            <p>Replace approved and used case quantities for existing products.</p>
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
                <h2>Upload quantity update</h2>
                <span>CSV, XLS, or XLSX</span>
            </div>
        </div>
        <p class="muted-copy">
            Required columns: <code>productId</code>, <code>casesApproved</code>, and <code>casesUsed</code>. Values
            replace the current quantities. Remaining cases and dollar totals are calculated automatically from the PO
            price.
        </p>
        <div class="upload-example">
            <strong>Example headers</strong>
            <code>productId,casesApproved,casesUsed</code>
            <code>PROD-301,200,9</code>
        </div>
        <div class="upload-drop">
            <input
                ref="fileInput"
                type="file"
                accept=".csv,.xls,.xlsx"
            />
            <span>Product IDs must already exist in the catalog.</span>
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
                @click="updateProducts"
            >
                {{ uploading ? 'Updating…' : 'Update quantities' }}
            </button>
        </div>
    </section>
</template>
