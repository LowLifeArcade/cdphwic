<script setup lang="ts">
import type { RequestStatus } from '~/../shared/domain';
defineProps<{ status: RequestStatus | string }>();
</script>

<template>
    <span
        class="status-badge"
        :class="`status-${status}`"
        >{{ status==='needs_info'?'Pending LA':String(status).replace('_', ' ') }}</span
    >
</template>
