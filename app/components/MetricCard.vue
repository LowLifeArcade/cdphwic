<script setup lang="ts">
defineProps<{ label: string; value: string | number; detail: string; tone?: string; icon?: string }>();
</script>

<template>
    <article class="metric-card">
        <div
            class="metric-icon"
            :class="`tone-${tone ?? 'purple'}`"
        >
            {{ icon ?? '◈' }}
        </div>
        <div>
            <p>{{ label }}</p>
            <strong>{{ value }}</strong>
            <span class="metric-detail">{{ detail }}</span>
        </div>
    </article>
</template>
