<script setup lang="ts">
import {formulaFormLabel} from '~/../shared/requestPresentation';
import type { ProductRecord } from '~/../shared/domain';

const { data } = await useFetch('/api/products');
const savedViewMode = useCookie<string>('products-view-mode', {
    default: () => 'grid',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
});
const viewMode = computed<'grid' | 'list'>({
    get: () => savedViewMode.value === 'list' ? 'list' : 'grid',
    set: (value) => {
        savedViewMode.value = value;
    },
});
const search = ref('');
const categoryFilter = ref('');
const formFilter = ref('');
const coverageFilter = ref('');
const openMenuId = ref<number | null>(null);
const menuPosition = ref({ top: '0px', left: '0px' });
const products = computed<ProductRecord[]>(() => data.value?.products ?? []);
const forms = computed(() => [...new Set(products.value.map((product) => product.form))].sort());
const filteredProducts = computed(() =>
    products.value.filter((product) => {
        const query = search.value.trim().toLowerCase();
        const matchesSearch =
            !query ||
            `${product.name} ${product.productId} ${product.productCode} ${product.supplierReference ?? ''} ${product.formulaDescription ?? ''} ${product.packaging ?? ''} ${product.flavor ?? ''} ${product.manufacturer ?? ''}`
                .toLowerCase()
                .includes(query);
        const matchesCategory = !categoryFilter.value || product.category === categoryFilter.value;
        const matchesForm = !formFilter.value || product.form === formFilter.value;
        const matchesCoverage =
            !coverageFilter.value || product.coverage.includes(coverageFilter.value as 'wic' | 'medical');
        return matchesSearch && matchesCategory && matchesForm && matchesCoverage;
    }),
);

function toggleProductMenu(id: number, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menuPosition.value = {
        top: `${Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - 64))}px`,
        left: `${Math.max(8, Math.min(rect.right - 150, window.innerWidth - 158))}px`,
    };
    openMenuId.value = openMenuId.value === id ? null : id;
}

function closeProductMenu() {
    openMenuId.value = null;
}

onMounted(() => {
    document.addEventListener('click', closeProductMenu);
    window.addEventListener('scroll', closeProductMenu, true);
    window.addEventListener('resize', closeProductMenu);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', closeProductMenu);
    window.removeEventListener('scroll', closeProductMenu, true);
    window.removeEventListener('resize', closeProductMenu);
});
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
            <option value="medical">Medi-Cal</option>
        </select>
        <div
            class="product-view-toggle"
            role="group"
            aria-label="Product view"
        >
            <button
                class="product-view-button"
                type="button"
                :aria-pressed="viewMode === 'grid'"
                @click="viewMode = 'grid'"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <rect x="2" y="2" width="4" height="4" rx="0.5" />
                    <rect x="10" y="2" width="4" height="4" rx="0.5" />
                    <rect x="2" y="10" width="4" height="4" rx="0.5" />
                    <rect x="10" y="10" width="4" height="4" rx="0.5" />
                </svg>
                Grid
            </button>
            <button
                class="product-view-button"
                type="button"
                :aria-pressed="viewMode === 'list'"
                @click="viewMode = 'list'"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    aria-hidden="true"
                >
                    <path d="M2 3h1m3 0h8M2 8h1m3 0h8M2 13h1m3 0h8" />
                </svg>
                List
            </button>
        </div>
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
                    <p v-if="product.formulaDescription" class="muted-copy">{{ product.formulaDescription }}</p>
                    <p v-if="product.packaging || product.flavor" class="muted-copy">{{ [product.flavor, product.packaging].filter(Boolean).join(' · ') }}</p>
                    <div class="coverage-tags">
                        <span
                            v-for="coverage in product.coverage"
                            :key="coverage"
                            class="coverage-tag"
                        >
                            {{ coverage === 'medical' ? 'Medi-Cal' : 'WIC' }}
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
                        @click="toggleProductMenu(product.id, $event)" @keydown.esc="closeProductMenu"
                    >
                        ⋯
                    </button>
                    <Teleport to="body">
                        <div v-if="openMenuId === product.id" class="product-menu" :style="menuPosition" @keydown.esc="closeProductMenu">
                            <NuxtLink :to="`/products/${product.id}`">Edit product</NuxtLink>
                        </div>
                    </Teleport>
                </div>
            </div>
            <div class="data-list">
                <div>
                    <span>Category</span><strong>{{ product.category }}</strong>
                </div>
                <div>
                    <span>Form</span><strong>{{ formulaFormLabel(product.form) }}</strong>
                </div>
                <div>
                    <span>Units / case</span><strong>{{ product.unitsPerCase ?? '—' }}</strong>
                </div>
                <div>
                    <span>Unit price</span
                    ><strong>{{ product.unitPrice ? `$${product.unitPrice.toFixed(2)}` : 'Not set' }}</strong>
                </div>
                <div>
                    <span>Supplier reference</span><strong>{{ product.supplierReference || 'Not set' }}</strong>
                </div>
                <div>
                    <span>Product Number</span><strong>{{ product.productCode }}</strong>
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
            <span>Product Number</span>
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
                <small v-if="product.formulaDescription">{{ product.formulaDescription }}</small>
                <small v-if="product.packaging || product.flavor">{{ [product.flavor, product.packaging].filter(Boolean).join(' · ') }}</small>
                <div
                    class="product-actions"
                    @click.stop
                >
                    <button
                        class="icon-button"
                        type="button"
                        aria-label="Product actions"
                        :aria-expanded="openMenuId === product.id"
                        @click="toggleProductMenu(product.id, $event)" @keydown.esc="closeProductMenu"
                    >
                        ⋯
                    </button>
                    <Teleport to="body">
                        <div v-if="openMenuId === product.id" class="product-menu" :style="menuPosition" @keydown.esc="closeProductMenu">
                            <NuxtLink :to="`/products/${product.id}`">Edit product</NuxtLink>
                        </div>
                    </Teleport>
                </div>
            </div>
            <span>{{ product.productId }}</span>
            <span>{{ product.productCode }}</span>
            <span>{{ product.category }}</span>
            <span>{{ formulaFormLabel(product.form) }}</span>
            <div class="coverage-tags">
                <span
                    v-for="coverage in product.coverage"
                    :key="coverage"
                    class="coverage-tag"
                >
                    {{ coverage === 'medical' ? 'Medi-Cal' : 'WIC' }}
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
