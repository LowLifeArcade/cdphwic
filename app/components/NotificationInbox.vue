<script setup lang="ts">
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const open = ref(false);
const message = ref('');
const { data, refresh, clear } = await useFetch('/api/surplus/notices', {
    headers: computed(() => ({ 'x-demo-user': identity.value })),
    server: false,
});
watch(identity,()=>{open.value=false;message.value='';clear();refresh();});
let noticeTimer:ReturnType<typeof setInterval>|undefined;
function refreshVisibleNotices(){if(!document.hidden)void refresh();}
onMounted(()=>{noticeTimer=setInterval(refreshVisibleNotices,60000);window.addEventListener('focus',refreshVisibleNotices);window.addEventListener('request-messages-changed',refreshVisibleNotices);});
onBeforeUnmount(()=>{if(noticeTimer)clearInterval(noticeTimer);window.removeEventListener('focus',refreshVisibleNotices);window.removeEventListener('request-messages-changed',refreshVisibleNotices);});
const unread = computed(() => data.value?.notices.filter((n) => !n.is_read).length ?? 0);
function openMessage(requestId:number){open.value=false;window.dispatchEvent(new CustomEvent('open-request-message',{detail:requestId}));}
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
            class="icon-button notice-trigger"
            aria-label="Notifications"
            :title="unread ? `${unread} unread notifications` : 'Notifications'"
            @click="
                open = !open;
                refresh();
            "
        >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg><span v-if="unread" class="notice-count" role="status" :aria-label="`${unread} unread notifications`">{{unread>99?'99+':unread}}</span>
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
            <p v-else-if="!data.notices.length">No active notifications.</p>
            <article
                v-for="n in data?.notices"
                :key="n.id"
                :class="{'notice-unread':!n.is_read}"
            >
                <span v-if="!n.is_read" class="notice-new">New</span>
                <strong>{{
                    n.title
                        ? n.title
                        : n.kind === 'forecast'
                        ? 'Confirm anticipated surplus'
                        : n.kind === 'donation'
                          ? 'Formula available for donation'
                          : 'Expired formula — destruction required'
                }}</strong>
                <template v-if="n.kind==='request-info' || n.kind==='request-eta' || n.kind==='request-response' || n.kind==='transfer-pickup'">
                    <p>Request #{{n.request_id}}</p><p class="request-notice-notes">{{n.notes}}</p>
                    <NuxtLink v-if="n.kind==='request-info'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="openMessage(n.request_id)">View Message</NuxtLink>
                    <NuxtLink v-else-if="n.kind==='transfer-pickup'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="open=false">View Shipment</NuxtLink>
                    <NuxtLink v-else-if="n.kind==='request-response'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="openMessage(n.request_id)">View Message</NuxtLink>
                    <template v-else><NuxtLink class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="open=false">View Shipment</NuxtLink><a class="button button-secondary" :href="`/api/requests/${n.request_id}/authorization-form.pdf?version=${n.version_id}`" target="_blank" rel="noopener">Print / Download Authorization</a></template>
                </template>
                <template v-else-if="n.kind==='transfer'">
                    <p>{{n.formula_name}} · {{n.form}}<template v-if="n.flavor"> · {{n.flavor}}</template><br />{{n.quantity}} units to ship · Request #{{n.request_id}}</p>
                    <NuxtLink class="button button-secondary" :to="{path:'/surplus',query:{transfer:n.transfer_id},hash:`#transfer-${n.transfer_id}`}" @click="open=false">View Transfer</NuxtLink>
                </template>
                <p v-else-if="n.kind === 'forecast'">
                    {{ n.expected_units }} anticipated units · confirmation due {{ n.due_date }}. Confirm actual usable,
                    uncommitted units in Formula Surplus.
                </p>
                <p v-else>
                    Agency {{ n.agency_id }} · {{ n.formula_name }} · {{ n.form }} {{ n.flavor }}<br />Expires
                    {{ n.expiration_date }} ·
                    {{ n.kind === 'donation' ? n.on_hand - n.reserved : n.expired_units }} units
                </p>
                <p v-if="n.kind === 'donation' || n.kind === 'destruction'">
                    {{
                        n.kind === 'donation'
                            ? 'At least 60 calendar days remain. Arrange donation of surplus. Coordinate with Admin/FPU before donating reserved units.'
                            : 'Keep these units quarantined. Complete the destruction form and record verified destruction.'
                    }}
                </p>
                <button
                    v-if="n.kind === 'donation' || n.kind === 'destruction'"
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
.notice-trigger {position:relative;}
.notice-count {position:absolute;top:-5px;right:-8px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:10px;background:#002595;color:#fff;font-size:11px;font-weight:700;border:2px solid var(--surface);}
.notice-new {display:inline-block;margin-right:8px;padding:2px 6px;border-radius:4px;background:#002595;color:#fff;font-size:11px;font-weight:600;}
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

<style scoped>.request-notice-notes{white-space:pre-wrap;overflow-wrap:anywhere;}</style>
