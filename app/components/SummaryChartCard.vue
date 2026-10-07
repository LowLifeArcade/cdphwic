<script setup lang="ts">
defineProps<{ title: string; items: Array<{ label: string; value: number }>; accent?: string }>();
const maxValue = (items: Array<{ value: number }>) => Math.max(...items.map((item) => item.value), 1);
</script>

<template>
    <article class="panel chart-card">
        <div class="panel-heading">
            <div>
                <h2>{{ title }}</h2>
                <span>Year to date</span>
            </div>
            <button class="text-button">View all →</button>
        </div>
        <div class="chart-list">
            <div
                v-for="item in items"
                :key="item.label"
                class="chart-row"
            >
                <div class="chart-label">
                    <span>{{ item.label }}</span
                    ><strong>{{ item.value }}</strong>
                </div>
                <div class="bar-track">
                    <span
                        class="bar-fill"
                        :style="{
                            width: `${(item.value / maxValue(items)) * 100}%`,
                            background: accent ?? 'var(--purple)',
                        }"
                    />
                </div>
            </div>
        </div>
    </article>
</template>
