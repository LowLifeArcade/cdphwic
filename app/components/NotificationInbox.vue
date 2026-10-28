<script setup lang="ts">
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const open = ref(false);
const message = ref('');
const { data, refresh } = await useFetch('/api/surplus/notices', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    server: false,
});
const unread = computed(() => data.value?.notices.filter((n) => !n.is_read).length ?? 0);
async function read(id: string) {
    await $fetch('/api/surplus/notices', {
        method: 'POST',
        headers: { 'x-demo-user': identity.value },
        body: { noticeId: id },
    });
    await refresh();
}
async function download(kind: string) {
    try {
        const blob = await $fetch<Blob>(`/api/surplus/forms?kind=${kind}`, {
            headers: { 'x-demo-user': identity.value },
            responseType: 'blob',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Formula-${kind}-Form.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        message.value = 'This form has not been uploaded yet.';
    }
}
</script>
<template>
    <div class="notice-wrap">
        <button
            class="icon-button"
            aria-label="Notifications"
            @click="
                open = !open;
                refresh();
            "
        >
            ♧<span v-if="unread"> {{ unread }}</span>
        </button>
        <section
            v-if="open"
            class="notice-panel"
        >
            <h3>Notifications</h3>
            <p
                v-if="message"
                role="status"
            >
                {{ message }}
            </p>
            <p v-if="!data">Unable to load notifications.</p>
            <p v-else-if="!data.notices.length">No active surplus notices.</p>
            <article
                v-for="n in data?.notices"
                :key="n.id"
            >
                <strong>{{
                    n.kind === 'forecast'
                        ? 'Confirm anticipated surplus'
                        : n.kind === 'donation'
                          ? 'Formula available for donation'
                          : 'Expired formula — destruction required'
                }}</strong>
                <p v-if="n.kind === 'forecast'">
                    {{ n.expected_units }} anticipated units · confirmation due {{ n.due_date }}. Confirm actual usable,
                    uncommitted units in Formula Surplus.
                </p>
                <p v-else>
                    Agency {{ n.agency_id }} · {{ n.formula_name }} · {{ n.form }} {{ n.flavor }}<br />Expires
                    {{ n.expiration_date }} ·
                    {{ n.kind === 'donation' ? n.on_hand - n.reserved : n.expired_units }} units
                </p>
                <p v-if="n.kind !== 'forecast'">
                    {{
                        n.kind === 'donation'
                            ? 'At least 60 calendar days remain. Arrange donation of surplus. Coordinate with Admin/FPU before donating reserved units.'
                            : 'Keep these units quarantined. Complete the destruction form and record verified destruction.'
                    }}
                </p>
                <button
                    v-if="n.kind !== 'forecast'"
                    class="button"
                    @click="download(n.kind)"
                >
                    Formula {{ n.kind === 'donation' ? 'Donation' : 'Destruction' }} Form</button
                ><button
                    v-if="!n.is_read"
                    class="button"
                    @click="read(n.id)"
                >
                    Mark read</button
                ><span v-else>Read</span>
            </article>
            <NuxtLink
                to="/surplus"
                @click="open = false"
                >Open formula surplus</NuxtLink
            >
        </section>
    </div>
</template>
<style scoped>
.notice-wrap {
    position: relative;
}
.notice-panel {
    position: absolute;
    right: 0;
    top: 45px;
    z-index: 100;
    width: min(440px, 85vw);
    max-height: 75vh;
    overflow: auto;
    background: var(--surface);
    color: var(--text, #253044);
    border: 1px solid var(--border, #6a7073);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 32px #0003;
}
.notice-panel article {
    padding: 16px 0;
    border-top: 1px solid var(--border, #6a7073);
}
.notice-panel p {
    font-size: 14px;
}
.notice-panel .button {
    margin: 4px;
}
</style>
