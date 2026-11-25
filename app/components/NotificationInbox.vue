<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import {formatDisplayDate,formulaFormLabel} from '~/../shared/requestPresentation';
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const open = ref(false);
const message = ref('');
type Notice = { id: string; kind: string; is_read: number; [key: string]: any };
const data = ref<{ notices: Notice[] }>();
const noticeFailure = ref('');
const noticeStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle');
let noticeRequest: AbortController | undefined;
async function refresh(restart = false) {
    if (noticeRequest && !restart) return;
    noticeRequest?.abort();
    const controller = new AbortController();
    noticeRequest = controller;
    noticeStatus.value = 'pending';
    noticeFailure.value = '';
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('/api/surplus/notices', {
            headers: { 'x-demo-user': identity.value, Accept: 'application/json' },
            signal: controller.signal,
            cache: 'no-store',
        });
        if (noticeRequest !== controller) return;
        if (!response.ok) {
            noticeFailure.value = `Server returned HTTP ${response.status}.`;
            noticeStatus.value = 'error';
            return;
        }
        const result = await response.json() as { notices: Notice[] };
        if (noticeRequest !== controller) return;
        if (!Array.isArray(result?.notices)) {
            noticeFailure.value = 'The server returned an unexpected response.';
            noticeStatus.value = 'error';
            return;
        }
        data.value = result;
        noticeStatus.value = 'success';
    } catch {
        if (noticeRequest === controller) {
            noticeFailure.value = controller.signal.aborted ? 'The request timed out.' : 'The browser could not reach the notifications endpoint.';
            noticeStatus.value = 'error';
        }
    } finally {
        clearTimeout(timer);
        if (noticeRequest === controller) noticeRequest = undefined;
    }
}
watch(identity, () => {
    open.value = false;
    message.value = '';
    data.value = undefined;
    void refresh(true);
});
let noticeTimer:ReturnType<typeof setInterval>|undefined;
function refreshVisibleNotices(){if(!document.hidden)void refresh();}
onMounted(()=>{void refresh();noticeTimer=setInterval(refreshVisibleNotices,15000);window.addEventListener('focus',refreshVisibleNotices);window.addEventListener('request-messages-changed',refreshVisibleNotices);});
onBeforeUnmount(()=>{noticeRequest?.abort();if(noticeTimer)clearInterval(noticeTimer);window.removeEventListener('focus',refreshVisibleNotices);window.removeEventListener('request-messages-changed',refreshVisibleNotices);});
function closeOnEscape(event:KeyboardEvent){if(event.key==='Escape')open.value=false;}
onMounted(()=>window.addEventListener('keydown',closeOnEscape));
onBeforeUnmount(()=>window.removeEventListener('keydown',closeOnEscape));
const unreadNotices = computed(() => data.value?.notices.filter(n => !n.is_read) ?? []);
const unread = computed(() => unreadNotices.value.length);
function openMessage(requestId:number){open.value=false;(document.activeElement as HTMLElement|null)?.blur();window.dispatchEvent(new CustomEvent('open-request-message',{detail:requestId}));}
function notificationTitle(n:any){const formula=String(n.formula_label??'').replaceAll(' · ',' ');return [n.participant_name,formula].filter(Boolean).join(' | ')||formula||'Formula Surplus';}
function notificationNature(n:any){return ({'request-info':'Request More Info','request-response':'Response to Request More Info','request-eta':'Shipment Update','request-special-order':'Special Order Delivery Update','transfer-availability':'Transfer Availability Response','transfer-stock':'Transfer Request','transfer-ready':'Transfer Labels Ready','transfer-confirmed':'Stock Confirmed','transfer-pickup':'Transfer Pickup',forecast:'Anticipated Surplus',donation:'Donation Reminder',destruction:'Destruction Required'} as Record<string,string>)[n.kind]??'Inventory Update';}
function toggleNotices() {
    open.value = !open.value;
    if (open.value) void refresh();
}
async function read(id: string) {
    message.value = '';
    try {
        await $fetch('/api/surplus/notices', {
            method: 'POST', headers: { 'x-demo-user': identity.value }, body: { noticeId: id },
        });
        if (data.value) data.value = { ...data.value, notices: data.value.notices.map(notice => notice.id === id ? { ...notice, is_read: 1 } : notice) };
        await refresh(true);
    } catch {
        message.value = 'Could not mark this notification as read. Try again.';
    }
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
    <div v-if="open" class="notice-backdrop" aria-hidden="true" @click="open=false"></div>
    <div class="notice-wrap">
        <button
            class="icon-button notice-trigger"
            aria-label="Notifications"
            :title="unread ? `${unread} unread notifications` : 'Notifications'"
            :aria-expanded="open"
            @click="toggleNotices"
        >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg><span class="notice-trigger-label">Notifications</span><span v-if="unread" class="notice-count" role="status" :aria-label="`${unread} unread notifications`">{{unread>99?'99+':unread}}</span>
        </button>
        <section
            v-if="open"
            class="notice-panel"
            aria-label="Notifications"
            @click.stop
        >
            <header class="notice-panel-heading">
                <h3>Notifications</h3>
                <NuxtLink to="/notifications" class="text-button" @click="open = false">View history</NuxtLink>
            </header>
            <p
                v-if="message"
                role="status"
            >
                {{ message }}
            </p>
            <p v-if="(noticeStatus === 'pending' || noticeStatus === 'idle') && !data" role="status">Loading notifications…</p>
            <p v-else-if="noticeStatus === 'error'" role="alert">Unable to load notifications. {{ noticeFailure }} <button class="text-button" type="button" @click="refresh()">Retry</button></p>
            <p v-else-if="!unreadNotices.length">No unread notifications.</p>
            <article
                v-for="n in unreadNotices"
                :key="n.id"
                :class="{'notice-unread':!n.is_read}"
            >
                <strong v-if="['request-info','request-eta','request-special-order','request-response','transfer-pickup','transfer-confirmed','transfer-availability','transfer-stock','transfer-ready'].includes(n.kind)" class="notice-title">{{notificationTitle(n)}}</strong>
                <strong v-else>{{
                    n.title
                        ? n.title
                        : n.kind === 'forecast'
                        ? 'Confirm anticipated surplus'
                        : n.kind === 'donation'
                          ? 'Formula available for donation'
                          : 'Formula under 45 days — destruction required'
                }}</strong>
                <p v-if="n.request_id" class="notice-submitted">Submitted {{ formatDisplayDate(n.submission_date) }}</p>
                <p v-if="['request-info','request-eta','request-special-order','request-response','transfer-pickup','transfer-confirmed','transfer-availability','transfer-stock','transfer-ready'].includes(n.kind)" class="notice-kind">{{notificationNature(n)}}</p>
                <template v-if="n.kind==='request-info' || n.kind==='request-eta' || n.kind==='request-special-order' || n.kind==='request-response' || n.kind==='transfer-pickup' || n.kind==='transfer-confirmed'">
                    <p v-if="n.kind==='request-info' || n.kind==='request-response'" class="request-notice-notes notice-message">{{n.notes}}</p>
                    <p v-else-if="n.kind==='request-eta'" class="notice-summary notice-message">Shipment details and authorization are ready.</p>
                    <template v-else-if="n.kind==='request-special-order'"><p v-if="n.actual_eta" class="notice-summary notice-message">Actual ETA: {{formatDisplayDate(n.actual_eta)}}</p><p v-else class="notice-summary notice-message">{{n.notes}} Anticipated ETA: {{formatDisplayDate(n.anticipated_eta)}}.</p><NuxtLink class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="open=false">View Request</NuxtLink></template>
                    <p v-else-if="n.kind==='transfer-pickup'" class="notice-summary notice-message">The sending agency confirmed GSO pickup.</p>
                    <p v-else class="notice-summary notice-message">The sending agency confirmed the reserved stock.</p>
                    <NuxtLink v-if="n.kind==='request-info'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id},hash:`#more-info-${n.request_id}`}" @click="openMessage(n.request_id)">View Message</NuxtLink>
                    <NuxtLink v-else-if="n.kind==='transfer-pickup' || n.kind==='transfer-confirmed'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id},hash:`#shipments-${n.request_id}`}" @click="open=false">View Shipment</NuxtLink>
                    <NuxtLink v-else-if="n.kind==='request-response'" class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id},hash:`#more-info-${n.request_id}`}" @click="openMessage(n.request_id)">View Message</NuxtLink>
                    <template v-else-if="n.kind==='request-eta'"><NuxtLink class="button button-secondary" :to="{path:'/requests',query:{request:n.request_id}}" @click="open=false">View Shipment</NuxtLink><a class="button button-secondary" :href="`/api/requests/${n.request_id}/authorization-form.pdf?version=${n.version_id}`" target="_blank" rel="noopener">Print / Download Authorization</a></template>
                </template>
                <template v-else-if="n.kind === 'transfer-availability'">
                    <p class="notice-summary notice-message">{{ n.notes }}</p>
                    <NuxtLink class="button button-secondary" :to="{path:'/surplus',query:{transfer:n.transfer_id},hash:`#transfer-${n.transfer_id}`}" @click="open=false">View Transfer</NuxtLink>
                </template>
                <template v-else-if="n.kind==='transfer-stock' || n.kind==='transfer-ready'">
                    <p class="notice-summary notice-message">{{n.quantity}} reserved {{unitLabel(n.quantity)}} · {{n.source_clinic_name || 'Clinic not specified'}}</p>
                    <NuxtLink class="button button-secondary" :to="{path:'/surplus',query:{transfer:n.transfer_id},hash:`#transfer-${n.transfer_id}`}" @click="open=false">{{n.kind==='transfer-stock'?'Confirm Product Availability':'View Labels & Arrange Pickup'}}</NuxtLink>
                </template>
                <p v-else-if="n.kind === 'forecast'" class="notice-message">
                    {{n.clinic_name || 'Clinic not specified'}}<br />
                    {{ n.expected_units }} anticipated {{unitLabel(n.expected_units)}} · confirmation due {{ formatDisplayDate(n.due_date) }}. Confirm actual usable,
                    uncommitted Units in Formula Surplus.
                </p>
                <p v-else>
                    Agency {{ n.agency_id }} · {{n.clinic_name || 'Clinic not specified'}}<br />{{ n.formula_name }} · {{ formulaFormLabel(n.form) }} {{ n.flavor }}<br />Expires
                    {{ formatDisplayDate(n.expiration_date) }} ·
                    {{ n.kind === 'donation' ? n.on_hand - n.reserved : (n.expired_units || n.on_hand - n.reserved) }} {{unitLabel(n.kind === 'donation' ? n.on_hand - n.reserved : (n.expired_units || n.on_hand - n.reserved))}}
                </p>
                <p v-if="n.kind === 'donation' || n.kind === 'destruction'" class="notice-message">
                    {{
                        n.kind === 'donation'
                            ? '45–60 calendar days remain. Arrange donation of surplus. Coordinate with Admin/FPU before donating reserved Units.'
                            : 'Fewer than 45 calendar days remain. Destroy these Units, complete the destruction form, and record verified destruction.'
                    }}
                </p>
                <button
                    v-if="n.kind === 'donation' || n.kind === 'destruction'"
                    class="button"
                    @click="download(n.kind)"
                >
                    Formula {{ n.kind === 'donation' ? 'Donation' : 'Destruction' }} Form</button
                ><button
                    class="text-button notice-mark-read"
                    type="button"
                    @click="read(n.id)"
                >
                    Mark read</button
                >
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
.notice-trigger {position:relative;display:flex;width:100%;height:40px;gap:10px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:var(--secondary-text, #a9b4c8);font-size:0.86rem;transition:0.2s ease;}
.notice-trigger:hover {background:var(--nav-active);color:var(--nav-text, #fff);}
.notice-backdrop {position:fixed;inset:0;z-index:69;background:transparent;}
.notice-trigger-label {font-size:14px;}
.notice-count {position:absolute;top:-5px;right:-8px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:10px;background:#002595;color:#fff;font-size:11px;font-weight:700;border:2px solid var(--surface);}
.notice-new {display:inline-block;margin-right:8px;padding:2px 6px;border-radius:4px;background:#002595;color:#fff;font-size:11px;font-weight:600;}
.notice-wrap {
    position: fixed;
    left:16px;
    bottom:84px;
    width:188px;
    z-index:70;
}
.notice-panel {
    position: absolute;
    left:0;
    bottom:48px;
    z-index: 100;
    width:min(440px,calc(100vw - 32px));
    max-height: 75vh;
    overflow: auto;
    background: var(--surface);
    color: var(--text, #253044);
    border: 1px solid var(--border, #6a7073);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 8px 32px #0003;
}
.notice-panel article {
    padding: 8px 0;
    border-top: 1px solid var(--border, #6a7073);
}
.notice-panel p {
    margin:3px 0;
    font-size: 13px;
}
.notice-panel .notice-context {font-weight:650;}
.notice-panel-heading {display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
.notice-panel-heading h3 {margin:0;font-size:1rem;}
.notice-panel .notice-message {color:light-dark(#174487,#a9caff);font-weight:600;overflow-wrap:anywhere;}
.notice-mark-read {margin-inline-start:8px;font-size:12px;}
.notice-panel .button {
    margin: 4px 4px 0 0;
    padding: 4px 7px;
    min-height: 26px;
    font-size: 12px;
}
</style>

<style scoped>.request-notice-notes{white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}</style>
