<script setup lang="ts">
const { data } = await useFetch('/api/summary');
const summary = computed(
    () =>
        data.value?.summary ?? {
            unitsByProduct: [],
            topFormulas: [],
            requestsByAgency: [],
            monthlyCases: 0,
            monthlyCapacity: 100,
            averageUnitsPerMonth: 0,
        },
);
const filters = reactive({ range: 'YTD', category: 'All categories', product: 'All products' });
const capacityPercent = computed(() => Math.round((summary.value.monthlyCases / summary.value.monthlyCapacity) * 100));
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Admin dashboard</p>
            <h1>Summary</h1>
            <p>Keep a clear view of request volume, product demand, and capacity.</p>
        </div>
        <div class="filter-bar">
            <select
                v-model="filters.range"
                class="filter-select"
            >
                <option>YTD</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option></select
            ><select
                v-model="filters.category"
                class="filter-select"
            >
                <option>All categories</option>
                <option>Standard</option>
                <option>Exempt</option>
                <option>Nutritional</option></select
            ><select
                v-model="filters.product"
                class="filter-select"
            >
                <option>All products</option>
                <option>Nutramigen</option>
                <option>EleCare</option>
            </select>
        </div>
    </div>
    <div class="metric-grid">
        <MetricCard
            label="Requests"
            value="128"
            detail="↑ 12% this month"
            icon="▤"
        />
        <MetricCard
            label="Units requested"
            :value="summary.averageUnitsPerMonth * 7"
            detail="↑ 8% month over month"
            tone="red"
            icon="◫"
        />
        <MetricCard
            label="Active agencies"
            value="14"
            detail="3 new this year"
            tone="green"
            icon="⌂"
        />
        <MetricCard
            label="Monthly capacity"
            :value="`${capacityPercent}%`"
            :detail="capacityPercent >= 90 ? 'Near capacity alert' : 'Within capacity'"
            tone="yellow"
            icon="◒"
        />
    </div>
    <div
        v-if="capacityPercent >= 90"
        class="notice"
        style="margin-bottom: 16px"
    >
        Capacity alert: current cases are within 10% of the monthly maximum.
    </div>
    <div class="dashboard-grid">
        <SummaryChartCard
            title="Units by product"
            :items="summary.unitsByProduct"
        />
        <SummaryChartCard
            title="Top requested formulas"
            :items="summary.topFormulas"
            accent="#74d39d"
        />
        <SummaryChartCard
            title="Requests by agency"
            :items="summary.requestsByAgency"
            accent="#e6bc6b"
        />
        <article class="panel">
            <div class="panel-heading">
                <div>
                    <h2>Cases vs monthly maximum</h2>
                    <span>Current period</span>
                </div>
                <strong style="color: var(--purple-light)"
                    >{{ summary.monthlyCases }} / {{ summary.monthlyCapacity }}</strong
                >
            </div>
            <div
                class="bar-track"
                style="height: 14px"
            >
                <span
                    class="bar-fill"
                    :style="{
                        width: `${capacityPercent}%`,
                        background: capacityPercent >= 90 ? 'var(--red)' : 'var(--purple)',
                    }"
                />
            </div>
            <p class="muted-copy">
                Average units per month YTD: <strong>{{ summary.averageUnitsPerMonth }}</strong>
            </p>
        </article>
    </div>
</template>
