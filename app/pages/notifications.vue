<script setup lang="ts">
import type { ArchivedNotification } from '#shared/notificationHistory';
import { formatDisplayDate } from '#shared/requestPresentation';

const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const { data, status, refresh, clear } = useFetch<{ notifications: ArchivedNotification[] }>('/api/surplus/notices/history', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    server: false,
    watch: false,
});
watch(identity, () => { clear(); void refresh(); });
</script>

<template>
    <section class="notification-history">
        <h1>Notification History</h1>
        <p>Notifications you’ve marked as read.</p>
        <p v-if="status === 'idle' || status === 'pending'" role="status">Loading notification history…</p>
        <p v-else-if="status === 'error'" role="alert">Unable to load notification history. <button class="text-button" type="button" @click="refresh()">Retry</button></p>
        <p v-else-if="!data?.notifications.length">No archived notifications yet.</p>
        <article v-for="notice in data?.notifications" :key="notice.id" class="archived-notification">
            <div class="archive-heading">
                <h2>{{ notice.title }}</h2>
                <small>Read {{ formatDisplayDate(notice.readAt?.slice(0, 10)) }}</small>
            </div>
            <p>{{ notice.message }}</p>
            <NuxtLink v-if="notice.transferId" class="text-button" :to="{ path: '/surplus', query: { transfer: notice.transferId } }">View Transfer</NuxtLink>
            <NuxtLink v-else-if="notice.requestId" class="text-button" :to="{ path: '/requests', query: { request: notice.requestId } }">View Request</NuxtLink>
            <NuxtLink v-else class="text-button" to="/surplus">View Formula Surplus</NuxtLink>
        </article>
    </section>
</template>

<style scoped>
.notification-history {max-width:760px;margin:0 auto;padding:24px;}
.archived-notification {padding:12px 0;border-top:1px solid var(--line);}
.archive-heading {display:flex;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;}
.archive-heading h2 {margin:0;font-size:1rem;}
.archive-heading small {color:var(--muted);}
.archived-notification p {margin:5px 0;color:light-dark(#174487,#a9caff);white-space:pre-wrap;overflow-wrap:anywhere;}
</style>
