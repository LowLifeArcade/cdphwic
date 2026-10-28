<script setup lang="ts">
import { isReviewer, availableUnits, localDate, daysRemaining, variantKey } from '~/../shared/surplus';
import type { SurplusLot } from '~/../shared/surplus';
const route = useRoute();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const headers = computed(() => ({ 'x-demo-user': identity.value }));
const { data, refresh, error } = await useFetch('/api/surplus', { headers, server: false });
const { data: agencyData } = await useFetch('/api/agencies');
const reviewer = computed(() => data.value?.user && isReviewer(data.value.user));
const search = ref(String(route.query.formula ?? ''));
const agency = ref(String(route.query.agency ?? ''));
const message = ref('');
const busy = ref(false);
const lots = computed(() =>
    ((data.value?.lots ?? []) as SurplusLot[]).filter(
        (l) =>
            (!agency.value || String(l.agencyId) === agency.value) &&
            (!search.value ||
                `${l.formulaName} ${l.flavor} ${l.form}`.toLowerCase().includes(search.value.toLowerCase())),
    ),
);
const agencyName = (id: number) => agencyData.value?.agencies.find((a) => a.id === id)?.name ?? `Agency ${id}`;
const operationId = ref('');
const modal = ref('');
const selected = ref<SurplusLot>();
const report = ref<any>();
const forecast = ref<any>();
const transfer = ref<any>();
const history = ref<any[]>([]);
const input = reactive({
    quantity: 0,
    reason: '',
    requestRef: String(route.query.request ?? ''),
    destinationAgencyId: 0,
    confirmerName: '',
    date: localDate(),
    expirationDate: '',
    formulaName: String(route.query.formula ?? ''),
    form: 'powder',
    flavor: '',
    agencyId: 10,
    dueDate: localDate(),
    trackingReference: '',
});
function start(kind: string, lot?: SurplusLot, item?: any) {
    operationId.value = crypto.randomUUID();
    modal.value = kind;
    selected.value = lot;
    report.value = undefined;
    forecast.value = undefined;
    transfer.value = undefined;
    message.value = '';
    Object.assign(input, {
        quantity: 0,
        reason: '',
        requestRef: String(route.query.request ?? ''),
        destinationAgencyId: 0,
        confirmerName: '',
        date: localDate(),
        expirationDate: lot?.expirationDate ?? '',
        trackingReference: '',
    });
    if (kind === 'review') {
        report.value = item;
        selected.value = ((data.value?.lots as SurplusLot[]) ?? []).find(
            (l) =>
                l.agencyId === item.agency_id &&
                variantKey(l) ===
                    variantKey({
                        formulaName: item.formula_name,
                        form: item.form,
                        flavor: item.flavor,
                        expirationDate: item.expiration_date,
                    }),
        );
        input.expirationDate = item.expiration_date;
        input.quantity = item.reported_units;
        input.reason = `Physical count reported by ${item.confirmer_name} on ${item.counted_at}`;
    }
    if (kind === 'confirm') {
        forecast.value = item;
    }
    if (['ship', 'receive', 'cancel'].includes(kind)) transfer.value = item;
}
const proposedCountChange = computed(
    () =>
        input.quantity -
        (selected.value
            ? selected.value.expirationDate < localDate()
                ? selected.value.expiredUnits
                : selected.value.onHand
            : 0),
);
const resolvingCount = ref(false);
const countReady = ref(false);
let countLookup = 0;
watch(
    () => [modal.value, report.value?.id, input.expirationDate] as const,
    async ([kind, reportId, date]) => {
        const lookup = ++countLookup;
        countReady.value = false;
        if (kind !== 'review' || !reportId || !date) {
            resolvingCount.value = false;
            return;
        }
        const currentReport = report.value;
        resolvingCount.value = true;
        selected.value = undefined;
        try {
            const snapshot = await $fetch('/api/surplus', { headers: headers.value });
            if (lookup !== countLookup) return;
            selected.value = snapshot.lots.find(
                (l) =>
                    l.agencyId === currentReport.agency_id &&
                    variantKey(l) ===
                        variantKey({
                            formulaName: currentReport.formula_name,
                            form: currentReport.form,
                            flavor: currentReport.flavor,
                            expirationDate: date,
                        }),
            );
            countReady.value = true;
        } catch {
            if (lookup === countLookup)
                message.value = 'Unable to load the matching balance. Close and reopen this report before reconciling.';
        } finally {
            if (lookup === countLookup) resolvingCount.value = false;
        }
    },
);
async function run(work: () => Promise<unknown>) {
    if (busy.value || resolvingCount.value || (modal.value === 'review' && !countReady.value)) return;
    busy.value = true;
    message.value = '';
    try {
        await work();
        modal.value = '';
        await refresh();
    } catch (e: any) {
        message.value = e.data?.message ?? e.data?.statusMessage ?? e.message ?? 'Unable to save.';
    } finally {
        busy.value = false;
    }
}
async function submit() {
    await run(async () => {
        if (modal.value === 'forecast')
            return $fetch('/api/surplus/forecasts', {
                method: 'POST',
                headers: headers.value,
                body: { ...input, expectedUnits: Number(input.quantity), agencyId: Number(input.agencyId) },
            });
        if (modal.value === 'confirm')
            return $fetch('/api/surplus/forecasts', {
                method: 'POST',
                headers: headers.value,
                body: { ...input, quantity: Number(input.quantity), forecastId: forecast.value.id },
            });
        let lot = selected.value;
        if (modal.value === 'new' || modal.value === 'review')
            lot = await $fetch<SurplusLot>('/api/surplus/lots', {
                method: 'POST',
                headers: headers.value,
                body: report.value
                    ? {
                          agencyId: report.value.agency_id,
                          formulaName: report.value.formula_name,
                          form: report.value.form,
                          flavor: report.value.flavor,
                          expirationDate: input.expirationDate,
                      }
                    : { ...input, agencyId: Number(input.agencyId) },
            });
        if (!lot) throw new Error('Inventory lot not found.');
        return $fetch('/api/surplus/commands', {
            method: 'POST',
            headers: headers.value,
            body: {
                operationId: operationId.value,
                kind: ['new', 'review'].includes(modal.value)
                    ? 'reconcile'
                    : modal.value === 'destroy'
                      ? 'deduct'
                      : modal.value,
                lotId: lot.id,
                quantity: Number(input.quantity),
                reason: modal.value === 'destroy' ? 'Destruction' : input.reason,
                requestRef: input.requestRef,
                confirmerName: input.confirmerName,
                date: input.date,
                expirationDate: input.expirationDate,
                destinationAgencyId: Number(input.destinationAgencyId),
                expectedVersion: selected.value?.version ?? 0,
                reportId: report.value?.id,
                transferId: transfer.value?.id,
                trackingReference: input.trackingReference,
            },
        });
    });
}
async function showHistory(lot: SurplusLot) {
    start('history', lot);
    history.value = await $fetch<any[]>('/api/surplus/history', { headers: headers.value, query: { lotId: lot.id } });
}
async function decideReport(status: string) {
    if (!input.reason.trim()) {
        message.value = 'Enter a review reason.';
        return;
    }
    await run(() =>
        $fetch<{ ok: boolean }>('/api/surplus/reports', {
            method: 'POST',
            headers: headers.value,
            body: { reportId: report.value.id, status, reason: input.reason },
        }),
    );
}
async function upload(kind: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await run(async () => {
        const body = new FormData();
        body.append('kind', kind);
        body.append('file', file);
        await $fetch('/api/surplus/forms', { method: 'POST', headers: headers.value, body });
        message.value = 'Form uploaded.';
    });
}
</script>
<template>
    <div class="surplus-page">
        <div class="page-heading">
            <div>
                <h1>Formula Surplus</h1>
                <p>Verified agency inventory, transfers and anticipated surplus.</p>
            </div>
            <div v-if="reviewer">
                <button
                    class="button"
                    @click="start('new')"
                >
                    Record physical count
                </button>
                <button
                    class="button button-main"
                    @click="start('forecast')"
                >
                    Anticipated surplus
                </button>
            </div>
        </div>
        <p
            v-if="error"
            role="alert"
        >
            Inventory could not be loaded. Please try again.
        </p>
        <p
            v-if="message"
            role="status"
        >
            {{ message }}
        </p>
        <div class="surplus-filters">
            <label
                >Search formula<input
                    v-model="search"
                    placeholder="Formula, form or flavor" /></label
            ><label v-if="reviewer"
                >Agency<select v-model="agency">
                    <option value="">All agencies</option>
                    <option
                        v-for="a in agencyData?.agencies"
                        :key="a.id"
                        :value="a.id"
                    >
                        {{ a.name }}
                    </option>
                </select></label
            ><button
                class="button"
                @click="refresh()"
            >
                Refresh
            </button>
        </div>
        <p>
            Available units exclude reservations and expired stock. Reported counts require reconciliation; anticipated
            quantities become available only after agency confirmation and review.
        </p>
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Agency / Formula</th>
                        <th>Expiration</th>
                        <th>Usable on hand</th>
                        <th>Reserved</th>
                        <th>Available</th>
                        <th>Expired / Quarantined</th>
                        <th>Total physical</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="lot in lots"
                        :key="lot.id"
                    >
                        <td>
                            {{ agencyName(lot.agencyId) }}<br /><strong>{{ lot.formulaName }}</strong
                            ><br />{{ lot.form }} {{ lot.flavor }}
                        </td>
                        <td>{{ lot.expirationDate }}</td>
                        <td>{{ lot.onHand }}</td>
                        <td>{{ lot.reserved }}</td>
                        <td>{{ availableUnits(lot) }}</td>
                        <td>{{ lot.expiredUnits }}</td>
                        <td>{{ lot.onHand + lot.expiredUnits }}</td>
                        <td class="row-actions">
                            <button
                                class="button"
                                @click="showHistory(lot)"
                            >
                                History</button
                            ><template v-if="reviewer"
                                ><button
                                    class="button"
                                    @click="start('reconcile', lot)"
                                >
                                    Reconcile count</button
                                ><button
                                    v-if="availableUnits(lot) > 0"
                                    class="button"
                                    @click="start('deduct', lot)"
                                >
                                    Deduct</button
                                ><button
                                    v-if="availableUnits(lot) > 0"
                                    class="button"
                                    @click="start('reserve', lot)"
                                >
                                    Request transfer</button
                                ><button
                                    v-if="lot.expiredUnits > 0"
                                    class="button"
                                    @click="start('destroy', lot)"
                                >
                                    Record destruction</button
                                ><button
                                    class="button"
                                    @click="start('correct-expiry', lot)"
                                >
                                    Correct expiration
                                </button></template
                            >
                        </td>
                    </tr>
                    <tr v-if="!lots.length">
                        <td colspan="8">No matching inventory.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <section>
            <h2>Pending physical counts</h2>
            <p>Counts replace the verified balance after review; they are never added to it.</p>
            <article
                v-for="r in data?.reports.filter((r: any) => r.status === 'pending')"
                :key="r.id"
            >
                <strong>{{ agencyName(r.agency_id) }} · {{ r.formula_name }}</strong> · {{ r.form }} {{ r.flavor }} ·
                {{ r.reported_units }} units · expires {{ r.expiration_date }}
                <p>Counted {{ r.counted_at }} by {{ r.confirmer_name }}. {{ r.reason }}</p>
                <button
                    v-if="reviewer"
                    class="button"
                    @click="start('review', undefined, r)"
                >
                    Review and reconcile
                </button>
            </article>
        </section>
        <section>
            <h2>Anticipated surplus</h2>
            <article
                v-for="f in data?.forecasts"
                :key="f.id"
            >
                <strong>{{ agencyName(f.agency_id) }} · {{ f.formula_name }}</strong> · {{ f.form }} {{ f.flavor }}
                <p>
                    {{ f.expected_units }} anticipated units · confirmation due {{ f.due_date }} · {{ f.status }}
                    <span v-if="f.actual_units !== null"> · actual {{ f.actual_units }}</span>
                </p>
                <button
                    v-if="f.status === 'awaiting-count'"
                    class="button"
                    @click="start('confirm', undefined, f)"
                >
                    Confirm actual surplus
                </button>
            </article>
        </section>
        <section>
            <h2>Transfers</h2>
            <article
                v-for="t in data?.transfers"
                :key="t.id"
            >
                <strong>{{ agencyName(t.source_agency_id) }} → {{ agencyName(t.destination_agency_id) }}</strong>
                <p>
                    {{ t.formula_name }} · {{ t.quantity }} units · {{ t.status }} · {{ t.request_ref }}
                    {{ t.tracking_reference }}
                </p>
                <template v-if="reviewer"
                    ><button
                        v-if="t.status === 'reserved'"
                        class="button"
                        @click="start('ship', data?.lots.find((l: any) => l.id === t.source_lot_id) as SurplusLot, t)"
                    >
                        Confirm shipment</button
                    ><button
                        v-if="t.status === 'reserved'"
                        class="button"
                        @click="start('cancel', data?.lots.find((l: any) => l.id === t.source_lot_id) as SurplusLot, t)"
                    >
                        Cancel reservation</button
                    ><button
                        v-if="t.status === 'shipped'"
                        class="button"
                        @click="
                            start('receive', data?.lots.find((l: any) => l.id === t.source_lot_id) as SurplusLot, t)
                        "
                    >
                        Confirm receipt
                    </button></template
                >
            </article>
        </section>
        <section v-if="data?.user.role === 'admin'">
            <h2>Agency notice forms</h2>
            <p>Upload the current forms used by donation and destruction notices.</p>
            <label
                >Formula Donation Form (PDF)<input
                    type="file"
                    accept="application/pdf"
                    @change="upload('donation', $event)" /></label
            ><label
                >Formula Destruction Form (PDF)<input
                    type="file"
                    accept="application/pdf"
                    @change="upload('destruction', $event)"
            /></label>
        </section>
        <div
            v-if="modal"
            class="surplus-backdrop"
            @click.self="!busy && (modal = '')"
        >
            <section
                class="surplus-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="surplus-dialog-title"
            >
                <h2 id="surplus-dialog-title">
                    {{
                        (
                            {
                                new: 'Record physical count',
                                review: 'Reconcile reported count',
                                forecast: 'Anticipated surplus',
                                confirm: 'Confirm actual usable, uncommitted surplus',
                                destroy: 'Record verified destruction',
                                'correct-expiry': 'Correct verified expiration date',
                                reconcile: 'Reconcile physical count',
                                deduct: 'Deduct surplus',
                                reserve: 'Request transfer',
                                ship: 'Confirm shipment',
                                receive: 'Confirm receipt',
                                cancel: 'Cancel reservation',
                                history: 'Inventory history',
                            } as any
                        )[modal]
                    }}
                </h2>
                <p v-if="selected">
                    {{ selected.formulaName }} · {{ selected.form }} {{ selected.flavor }} ·
                    {{ agencyName(selected.agencyId) }}
                </p>
                <p
                    v-if="message"
                    role="alert"
                >
                    {{ message }}
                </p>
                <div v-if="modal === 'history'">
                    <article
                        v-for="h in history"
                        :key="h.id"
                    >
                        {{ h.created_at }} · {{ h.kind }} · {{ h.quantity }} units
                        <p>
                            Usable {{ h.on_hand }} / reserved {{ h.reserved }} / expired {{ h.expired_units }} ·
                            {{ h.request_ref }}
                        </p>
                        <p>{{ h.reason }}</p>
                    </article>
                    <button
                        class="button"
                        @click="modal = ''"
                    >
                        Close
                    </button>
                </div>
                <form
                    v-else
                    @submit.prevent="submit"
                >
                    <template v-if="['new', 'forecast'].includes(modal)"
                        ><label
                            >Agency<select
                                v-model="input.agencyId"
                                required
                            >
                                <option
                                    v-for="a in agencyData?.agencies"
                                    :key="a.id"
                                    :value="a.id"
                                >
                                    {{ a.name }}
                                </option>
                            </select></label
                        ><label
                            >Formula Name<input
                                v-model="input.formulaName"
                                required /></label
                        ><label
                            >Form<select v-model="input.form">
                                <option value="powder">Powder</option>
                                <option value="concentrate">Liquid Concentrate</option>
                                <option value="ready-to-feed">Ready-to-Feed</option>
                            </select></label
                        ><label>Flavor (if applicable)<input v-model="input.flavor" /></label
                    ></template>
                    <label
                        v-if="
                            ['new', 'reconcile', 'deduct', 'reserve', 'destroy', 'confirm', 'forecast'].includes(modal)
                        "
                        >{{ modal === 'forecast' ? 'Anticipated units' : 'Units'
                        }}<input
                            v-model.number="input.quantity"
                            type="number"
                            :min="['new', 'reconcile', 'confirm', 'forecast'].includes(modal) ? 0 : 1"
                            step="1"
                            required
                    /></label>
                    <p v-if="selected && ['review', 'reconcile'].includes(modal)">
                        Current usable count {{ selected.onHand }}, reserved {{ selected.reserved }}, expired
                        {{ selected.expiredUnits }}. Inventory version {{ selected.version }}. Proposed change:
                        {{ proposedCountChange }} units.
                    </p>
                    <p v-if="modal === 'review'">
                        Reported count: {{ report.reported_units }} units, expires {{ report.expiration_date }}. Confirm
                        this replaces the current balance for this formula, form, flavor and expiration.
                    </p>
                    <label v-if="['new', 'review', 'confirm', 'correct-expiry'].includes(modal)"
                        >Expiration date<input
                            v-model="input.expirationDate"
                            :readonly="modal === 'review' && !!report?.expiration_date"
                            type="date"
                            required /></label
                    ><label v-if="modal === 'forecast'"
                        >Agency confirmation due<input
                            v-model="input.dueDate"
                            type="date"
                            required
                    /></label>
                    <label v-if="['new', 'review', 'reconcile', 'correct-expiry', 'confirm'].includes(modal)"
                        >{{ modal === 'confirm' ? 'Variance explanation (required if actual differs)' : 'Reason'
                        }}<textarea
                            v-model="input.reason"
                            :required="modal !== 'confirm' || input.quantity !== forecast.expected_units"
                            rows="2"
                        ></textarea>
                    </label>
                    <label v-if="modal === 'deduct'"
                        >Reason<select
                            v-model="input.reason"
                            required
                        >
                            <option value="">Select reason</option>
                            <option value="Request fulfillment">Request fulfillment</option>
                            <option
                                v-if="selected && daysRemaining(selected.expirationDate, localDate()) >= 60"
                                value="Donation"
                            >
                                Donation
                            </option>
                            <option value="Inventory correction">Inventory correction</option>
                        </select></label
                    >
                    <label v-if="['deduct', 'destroy', 'reserve', 'forecast'].includes(modal)"
                        >Request / reference<input
                            v-model="input.requestRef"
                            required /></label
                    ><label v-if="modal === 'reserve'"
                        >Destination agency<select
                            v-model.number="input.destinationAgencyId"
                            required
                        >
                            <option
                                :value="0"
                                disabled
                            >
                                Select agency
                            </option>
                            <option
                                v-for="a in agencyData?.agencies.filter((a) => a.id !== selected?.agencyId)"
                                :key="a.id"
                                :value="a.id"
                            >
                                {{ a.name }}
                            </option>
                        </select></label
                    >
                    <template v-if="['confirm', 'destroy'].includes(modal)"
                        ><label
                            >Staff name<input
                                v-model="input.confirmerName"
                                required /></label
                        ><label
                            >{{ modal === 'destroy' ? 'Verified destruction date' : 'Physical count date'
                            }}<input
                                v-model="input.date"
                                type="date"
                                :max="localDate()"
                                required /></label></template
                    ><label v-if="modal === 'ship'"
                        >Tracking / shipment reference<input v-model="input.trackingReference"
                    /></label>
                    <p v-if="modal === 'receive'">
                        Confirm physical receipt. Expired arrivals will enter the quarantined bucket.
                    </p>
                    <p v-if="modal === 'destroy'">
                        Confirm these units have been physically destroyed and the Formula Destruction Form completed.
                    </p>
                    <div
                        v-if="modal === 'review'"
                        class="dialog-actions"
                    >
                        <button
                            class="button"
                            type="button"
                            :disabled="busy"
                            @click="decideReport('rejected')"
                        >
                            Reject report</button
                        ><button
                            class="button"
                            type="button"
                            :disabled="busy"
                            @click="decideReport('already-accounted')"
                        >
                            Already accounted for
                        </button>
                    </div>
                    <div class="dialog-actions">
                        <button
                            class="button"
                            type="button"
                            :disabled="busy"
                            @click="modal = ''"
                        >
                            Cancel</button
                        ><button
                            class="button button-main"
                            :disabled="busy || resolvingCount || (modal === 'review' && !countReady)"
                        >
                            {{ busy ? 'Saving…' : 'Confirm' }}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    </div>
</template>
<style scoped>
.surplus-page {
    padding: 28px;
}
.page-heading,
.surplus-filters,
.dialog-actions {
    display: flex;
    gap: 16px;
    align-items: end;
    justify-content: space-between;
}
.surplus-filters {
    justify-content: start;
    margin: 20px 0;
}
label {
    display: grid;
    gap: 6px;
    margin: 12px 0;
}
input,
select,
textarea {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 9px;
    max-width: 100%;
}
section {
    margin-top: 28px;
}
article {
    border-bottom: 1px solid var(--line);
    padding: 16px 0;
}
p {
    color: var(--muted);
}
.table-scroll {
    overflow: auto;
}
table {
    width: 100%;
    border-collapse: collapse;
}
th,
td {
    text-align: left;
    padding: 12px 10px;
    border-bottom: 1px solid var(--line);
}
th {
    color: var(--muted);
    font-size: 13px;
}
td:nth-child(2) { white-space: nowrap; }
.row-actions { min-width: 215px; }
.surplus-page .button:not(.button-main):not(.button-primary):not(.button-secondary):not(.button-danger) { background: var(--button-neutral-bg); border: 1px solid #6a7073; color: var(--button-neutral-text); }
.row-actions .button {
    margin: 3px;
    font-size: 13px;
    padding: 7px 9px;
}
.surplus-backdrop {
    position: fixed;
    inset: 0;
    background: #000a;
    display: grid;
    place-items: center;
    z-index: 110;
    padding: 20px;
}
.surplus-dialog {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    width: min(560px, 100%);
    max-height: 90vh;
    overflow: auto;
    padding: 24px;
    margin: 0;
}
.dialog-actions {
    margin-top: 20px;
}
h1 {
    margin-bottom: 8px;
}
@media (max-width: 650px) {
    .page-heading,
    .surplus-filters {
        display: block;
    }
    .surplus-page {
        padding: 16px;
    }
}
</style>
