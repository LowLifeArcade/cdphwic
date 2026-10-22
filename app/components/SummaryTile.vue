<script setup lang="ts">
const viewport = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflowing = ref(false);
let observer: ResizeObserver | undefined;

onMounted(() => {
    observer = new ResizeObserver(() => {
        // 300px tile minus its padding and border; the footer is only added for overflow.
        overflowing.value = (content.value?.getBoundingClientRect().height ?? 0) > 260;
    });
    if (content.value) {
        observer.observe(content.value);
    }
});

onBeforeUnmount(() => observer?.disconnect());

function toggleExpanded() {
    expanded.value = !expanded.value;
    if (!expanded.value) {
        viewport.value?.scrollTo({ top: 0 });
    }
}
</script>

<template>
    <article
        class="panel summary-tile"
        :class="{ 'summary-tile-expanded': expanded }"
    >
        <div
            ref="viewport"
            class="summary-tile-viewport"
            :tabindex="overflowing && !expanded ? 0 : undefined"
        >
            <div ref="content">
                <slot />
            </div>
        </div>
        <button
            v-if="overflowing"
            class="text-button summary-tile-toggle"
            type="button"
            :aria-expanded="expanded"
            @click="toggleExpanded"
        >
            {{ expanded ? 'Collapse ↑' : 'Expand ↓' }}
        </button>
    </article>
</template>
