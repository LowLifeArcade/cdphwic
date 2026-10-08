<script setup lang="ts">
import type { ProductRecord } from '~/../shared/domain';

const { data } = await useFetch('/api/products');
const viewMode = ref<'grid' | 'list'>('grid');
const search = ref('');
const categoryFilter = ref('');
const formFilter = ref('');
const coverageFilter = ref('');
const openMenuId = ref<number | null>(null);
const products = computed<ProductRecord[]>(() => data.value?.products ?? []);
const forms = computed(() => [...new Set(products.value.map((product) => product.form))].sort());
const filteredProducts = computed(() =>
    products.value.filter((product) => {
        const query = search.value.trim().toLowerCase();
        const matchesSearch =
            !query ||
            `${product.name} ${product.productId} ${product.productCode} ${product.supplierReference ?? ''}`
                .toLowerCase()
                .includes(query);
        const matchesCategory = !categoryFilter.value || product.category === categoryFilter.value;
        const matchesForm = !formFilter.value || product.form === formFilter.value;
        const matchesCoverage =
            !coverageFilter.value || product.coverage.includes(coverageFilter.value as 'wic' | 'medical');
        return matchesSearch && matchesCategory && matchesForm && matchesCoverage;
    }),
);

function toggleProductMenu(id: number) {
    openMenuId.value = openMenuId.value === id ? null : id;
}

function closeProductMenu() {
    openMenuId.value = null;
}

onMounted(() => document.addEventListener('click', closeProductMenu));
onBeforeUnmount(() => document.removeEventListener('click', closeProductMenu));
</script>
<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Products</h1>
            <p>Formula catalog with category and packaging information.</p>
        </div>
        <div class="form-actions">
            <NuxtLink
                class="button button-secondary"
                to="/products/bulk-upload"
                >⇧ Bulk upload</NuxtLink
            >
            <NuxtLink
                class="button button-secondary"
                to="/products/bulk-update"
                >↻ Bulk update</NuxtLink
            >
            <NuxtLink
                class="button button-primary"
                to="/products/new"
                >＋ Add product</NuxtLink
            >
        </div>
    </div>
    <div class="catalog-toolbar">
        <input
            v-model="search"
            class="form-input"
            placeholder="Search products"
            aria-label="Search products"
        />
        <select
            v-model="categoryFilter"
            class="filter-select"
            aria-label="Filter by category"
        >
            <option value="">All categories</option>
            <option value="standard">Standard</option>
            <option value="exempt">Exempt</option>
            <option value="nutritional">Nutritional</option>
        </select>
        <select
            v-model="formFilter"
            class="filter-select"
            aria-label="Filter by form"
        >
            <option value="">All forms</option>
            <option
                v-for="form in forms"
                :key="form"
                :value="form"
            >
                {{ form }}
            </option>
        </select>
        <select
            v-model="coverageFilter"
            class="filter-select"
            aria-label="Filter by coverage"
        >
            <option value="">All coverage</option>
            <option value="wic">WIC</option>
            <option value="medical">Medical</option>
        </select>
        <label class="view-select">
            <span>View as</span>
            <select
                v-model="viewMode"
                class="filter-select"
                aria-label="View as"
            >
                <option value="grid">Grid</option>
                <option value="list">List</option>
            </select>
        </label>
    </div>
    <div
        v-if="viewMode === 'grid'"
        class="detail-page-grid"
    >
        <article
            v-for="product in filteredProducts"
            :key="product.id"
            class="data-card"
        >
            <div class="panel-heading product-card-heading">
                <div>
                    <h3>{{ product.name }}</h3>
                    <div class="coverage-tags">
                        <span
                            v-for="coverage in product.coverage"
                            :key="coverage"
                            class="coverage-tag"
                        >
                            {{ coverage }}
                        </span>
                    </div>
                </div>
                <div
                    class="product-actions"
                    @click.stop
                >
                    <button
                        class="icon-button"
                        type="button"
                        aria-label="Product actions"
                        :aria-expanded="openMenuId === product.id"
                        @click="toggleProductMenu(product.id)"
                    >
                        ⋯
                    </button>
                    <div
                        v-if="openMenuId === product.id"
                        class="product-menu"
                    >
                        <NuxtLink :to="`/products/${product.id}`">Edit product</NuxtLink>
                    </div>
                </div>
            </div>
            <div class="data-list">
                <div>
                    <span>Category</span><strong>{{ product.category }}</strong>
                </div>
                <div>
                    <span>Form</span><strong>{{ product.form }}</strong>
                </div>
                <div>
                    <span>Units / case</span><strong>{{ product.unitsPerCase }}</strong>
                </div>
                <div>
                    <span>Unit price</span
                    ><strong>{{ product.unitPrice ? `$${product.unitPrice.toFixed(2)}` : 'Not set' }}</strong>
                </div>
                <div>
                    <span>Supplier reference</span><strong>{{ product.supplierReference || 'Not set' }}</strong>
                </div>
                <div>
                    <span>Product code</span><strong>{{ product.productCode }}</strong>
                </div>
                <div>
                    <span>Product ID</span><strong>{{ product.productId }}</strong>
                </div>
                <div>
                    <span>Cases remaining</span><strong>{{ product.casesRemaining ?? 0 }}</strong>
                </div>
                <div>
                    <span>Cases appoved</span><strong>{{ product.casesApproved ?? 0 }}</strong>
                </div>
                <div>
                    <span>PO price</span
                    ><strong>{{ product.poPrice ? `$${product.poPrice.toFixed(2)}` : 'Not set' }}</strong>
                </div>
                <div>
                    <span>$ remaining</span
                    ><strong>{{
                        product.dollarsRemaining ? `$${product.dollarsRemaining.toFixed(2)}` : '$0.00'
                    }}</strong>
                </div>
            </div>
        </article>
    </div>
    <div
        v-else
        class="product-list"
    >
        <div class="product-list-header">
            <span>Product</span>
            <span>Product ID</span>
            <span>Product code</span>
            <span>Category</span>
            <span>Form</span>
            <span>Coverage</span>
            <span>Approved</span>
            <span>Used</span>
            <span>Remaining</span>
            <span>PO price</span>
            <span>Actions</span>
        </div>
        <div
            v-for="product in filteredProducts"
            :key="product.id"
            class="product-list-row"
        >
            <div class="product-list-name">
                <strong>{{ product.name }}</strong>
                <div
                    class="product-actions"
                    @click.stop
                >
                    <button
                        class="icon-button"
                        type="button"
                        aria-label="Product actions"
                        :aria-expanded="openMenuId === product.id"
                        @click="toggleProductMenu(product.id)"
                    >
                        ⋯
                    </button>
                    <div
                        v-if="openMenuId === product.id"
                        class="product-menu"
                    >
                        <NuxtLink :to="`/products/${product.id}`">Edit product</NuxtLink>
                    </div>
                </div>
            </div>
            <span>{{ product.productId }}</span>
            <span>{{ product.productCode }}</span>
            <span>{{ product.category }}</span>
            <span>{{ product.form }}</span>
            <div class="coverage-tags">
                <span
                    v-for="coverage in product.coverage"
                    :key="coverage"
                    class="coverage-tag"
                >
                    {{ coverage }}
                </span>
            </div>
            <span>{{ product.casesApproved ?? 0 }}</span>
            <span>{{ product.casesUsed ?? 0 }}</span>
            <span>{{ product.casesRemaining ?? 0 }}</span>
            <span>{{ product.poPrice ? `$${product.poPrice.toFixed(2)}` : 'Not set' }}</span>
        </div>
        <p
            v-if="!filteredProducts.length"
            class="muted-copy"
        >
            No products match these filters.
        </p>
    </div>
</template>
