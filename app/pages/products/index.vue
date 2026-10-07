<script setup lang="ts">
const { data } = await useFetch('/api/products');
</script>
<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Catalog</p>
            <h1>Products</h1>
            <p>Formula catalog with category and packaging information.</p>
        </div>
        <button class="button button-primary">＋ Add product</button>
    </div>
    <div class="detail-page-grid">
        <article
            v-for="product in data?.products ?? []"
            :key="product.id"
            class="data-card"
        >
            <div class="panel-heading">
                <h3>{{ product.name }}</h3>
                <span class="status-badge status-approved">Active</span>
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
            </div>
        </article>
    </div>
</template>
