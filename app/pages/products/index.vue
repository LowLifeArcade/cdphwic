<script setup lang="ts">
import { productEditorFields, productEditorOptionLabel } from '~/../shared/productEditor';
import type { ProductRecord } from '~/../shared/domain';

const { data } = await useFetch('/api/products');
const search = ref('');
const mcKessonPoFilter = ref<string | null>('');
const wicCategoryFilter = ref<string | null>('');
const columns = productEditorFields.slice(0, 10);
const products = computed<ProductRecord[]>(() => data.value?.products ?? []);
const alphabetic = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const mcKessonPoValues = computed(() => [...new Set(products.value.map(product => product.mcKessonPo?.trim()).filter((value): value is string => Boolean(value)))].sort(alphabetic.compare));
const wicCategories = productEditorFields.find(field => field.key === 'wicClass')!.options;

function matchesValue(value: string | undefined, selected: string | null) {
    return selected === '' || (value?.trim() ?? '') === (selected ?? '');
}

function isMediCalCovered(product: ProductRecord) {
    return product.coveredByMediCal ?? product.coverage.includes('medical');
}

const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase();
    return products.value.filter(product => {
        const matchesSearch = !query || [product.name, product.productId, product.productCode,
            product.formulaDescription, product.packaging, product.flavor, product.manufacturer, product.supplierReference]
            .some(value => value?.toLowerCase().includes(query));
        return matchesSearch && matchesValue(product.mcKessonPo, mcKessonPoFilter.value)
            && matchesValue(product.wicClass, wicCategoryFilter.value);
    }).sort((a, b) => alphabetic.compare(a.name, b.name)
        || alphabetic.compare(a.formulaDescription ?? '', b.formulaDescription ?? '')
        || alphabetic.compare(a.productCode, b.productCode));
});

function cellValue(product: ProductRecord, key: (typeof columns)[number]['key']) {
    const value = product[key];
    if (value === undefined || value === null || value === '') return '—';
    return key === 'form' ? productEditorOptionLabel(String(value)) : String(value);
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Products</h1>
            <p>Formula catalog. Open a product to view or edit its full details.</p>
        </div>
        <div class="form-actions">
            <NuxtLink class="button button-secondary" to="/products/bulk-upload">⇧ Bulk upload</NuxtLink>
            <NuxtLink class="button button-secondary" to="/products/bulk-update">↻ Bulk update</NuxtLink>
            <NuxtLink class="button button-primary" to="/products/new">＋ Add product</NuxtLink>
        </div>
    </div>

    <div class="catalog-toolbar">
        <input v-model="search" class="form-input" placeholder="Search products" aria-label="Search products" />
        <select v-model="mcKessonPoFilter" class="filter-select" aria-label="Filter by McKesson PO">
            <option value="">McKesson PO</option>
            <option :value="null">Not specified</option>
            <option v-for="value in mcKessonPoValues" :key="value" :value="value">{{ value }}</option>
        </select>
        <select v-model="wicCategoryFilter" class="filter-select" aria-label="Filter by WIC Category">
            <option value="">All WIC categories</option>
            <option :value="null">Not specified</option>
            <option v-for="value in wicCategories" :key="value" :value="value">{{ value }}</option>
        </select>
        <span class="catalog-count">{{ filteredProducts.length }} product{{ filteredProducts.length === 1 ? '' : 's' }}</span>
    </div>

    <div class="product-list" role="region" aria-label="Product catalog" tabindex="0">
        <table class="product-catalog-table" aria-label="Products">
            <colgroup>
                <col v-for="column in columns" :key="column.key" :class="`product-column-${column.key}`" />
                <col class="product-column-actions" />
            </colgroup>
            <thead>
                <tr>
                    <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'numeric-cell': column.key === 'unitsPerCase' || column.key === 'yield' }">{{ column.label }}</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="product in filteredProducts" :key="product.id">
                    <td v-for="column in columns" :key="column.key" :class="{ 'numeric-cell': column.key === 'unitsPerCase' || column.key === 'yield' }" :title="column.key === 'coveredByMediCal' ? undefined : cellValue(product, column.key)">
                        <template v-if="column.key === 'coveredByMediCal'">
                            <span v-if="isMediCalCovered(product)" class="coverage-tag">Medi-Cal</span>
                            <span v-else>—</span>
                        </template>
                        <NuxtLink v-else-if="column.key === 'formulaDescription' || column.key === 'name' || column.key === 'productCode'" :to="`/products/${product.id}`">{{ cellValue(product, column.key) }}</NuxtLink>
                        <template v-else>{{ cellValue(product, column.key) }}</template>
                    </td>
                    <td><NuxtLink :to="`/products/${product.id}`" :aria-label="`Edit product ${product.name || product.productCode || product.id}`">Edit</NuxtLink></td>
                </tr>
                <tr v-if="!filteredProducts.length">
                    <td :colspan="columns.length + 1" class="catalog-empty">No products match these filters.</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
