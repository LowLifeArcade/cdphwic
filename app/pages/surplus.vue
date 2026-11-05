<script setup lang="ts">
import {formatDisplayDate,formulaFormLabel} from '~/../shared/requestPresentation';
import { isReviewer, availableUnits, localDate, daysRemaining, variantKey } from '~/../shared/surplus';
import {surplusShipmentDraft} from '~/../shared/requestTransfers';
import {formatClinic,type ClinicAddress,type ClinicRecord} from '~/../shared/shipping';
import type {RequestRecord} from '~/../shared/domain';
import type { SurplusLot } from '~/../shared/surplus';
function pickupAddress(json?:string|null){try{const value=JSON.parse(json??'null') as ClinicAddress|null;return value?formatClinic(value):'';}catch{return '';}}
const route = useRoute();
const view=ref<'inventory'|'transfers'|'counts'>(route.query.transfer?'transfers':'inventory');
watch(()=>route.query.transfer,id=>{if(id)view.value='transfers';});
const requestChoices=ref<RequestRecord[]>([]);
const requestsLoading=ref(false);
const requestChoiceError=ref('');
const destinationRequest=ref('');
const requestSearch=ref('');
const matchingRequests=computed(()=>selected.value?requestChoices.value.filter(r=>surplusShipmentDraft(r,selected.value!,[])&&(!requestSearch.value||`${r.id} ${r.submissionId??''} ${r.participantName} ${agencyName(r.agencyId)}`.toLowerCase().includes(requestSearch.value.toLowerCase()))):[]);
async function useInRequest(lot:SurplusLot){
 start('use-request',lot);destinationRequest.value='';requestSearch.value='';requestChoiceError.value='';requestsLoading.value=true;
 try{const result=await $fetch<{requests:RequestRecord[]}>('/api/requests',{headers:headers.value});requestChoices.value=result.requests;}
 catch{requestChoiceError.value='Requests could not be loaded. Close and try again.';requestChoices.value=[];}
 finally{requestsLoading.value=false;}
}
async function openShipment(){
 const request=matchingRequests.value.find(r=>String(r.id)===destinationRequest.value);
 if(!request||!selected.value)return;
 await navigateTo({path:'/requests',query:{request:request.id,surplusLot:selected.value.id},hash:`#shipments-${request.id}`});
}
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const headers = computed(() => ({ 'x-demo-user': identity.value }));
const { data, refresh, error } = await useFetch('/api/surplus', { headers, server: false });
async function refreshTransferState(){await refresh();await refreshNuxtData('pending-transfer-count');}
const { data: agencyData } = await useFetch('/api/agencies');
watch([()=>route.query.transfer,()=>data.value?.transfers],async([selected])=>{
    const id=typeof selected==='string'?selected:'';
    if(!id||!data.value?.transfers.some(t=>t.id===id))return;
    await nextTick();
    const target=document.getElementById(`transfer-${id}`);
    target?.scrollIntoView({block:'center'});target?.focus({preventScroll:true});
},{immediate:true,flush:'post'});

const reviewer = computed(() => data.value?.user && isReviewer(data.value.user));
const search = ref(String(route.query.formula ?? ''));
const agency = ref(String(route.query.agency ?? ''));
const clinic = ref('');
const clinicChoices=computed(()=>Array.from(new Map(((data.value?.lots??[]) as SurplusLot[]).filter(l=>!agency.value||String(l.agencyId)===agency.value).filter(l=>l.clinicId).map(l=>[l.clinicId!,l.clinicName||'Clinic'])).entries()));
watch(agency,()=>{clinic.value='';});
const message = ref('');
const busy = ref(false);
const lots = computed(() =>
    ((data.value?.lots ?? []) as SurplusLot[]).filter(
        (l) =>
            (!agency.value || String(l.agencyId) === agency.value) &&
            (!clinic.value || (clinic.value==='unspecified'?!l.clinicId:l.clinicId===clinic.value)) &&
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
    clinicId: '',
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
const clinicAgency=computed(()=>modal.value==='review'?report.value?.agency_id:modal.value==='confirm'?forecast.value?.agency_id:selected.value?.agencyId??input.agencyId);
const {data:formClinics,error:clinicError,status:clinicStatus}=await useFetch<{clinics:ClinicRecord[]}>(()=>`/api/agencies/${clinicAgency.value}/clinics`,{headers,server:false});
watch(()=>input.agencyId,()=>{if(['new','forecast'].includes(modal.value))input.clinicId='';});
function start(kind: string, lot?: SurplusLot, item?: any) {
    operationId.value = crypto.randomUUID();
    modal.value = kind;
    selected.value = lot;
    report.value = undefined;
    forecast.value = undefined;
    transfer.value = undefined;
    message.value = '';
    Object.assign(input, {
        clinicId: lot?.clinicId ?? item?.clinic_id ?? '',
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
                l.agencyId === item.agency_id && (l.clinicId??'')===(item.clinic_id??'') &&
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
    if (kind === 'cancel') transfer.value = item;
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
    () => [modal.value, report.value?.id, input.expirationDate, input.clinicId] as const,
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
                    l.agencyId === currentReport.agency_id && (l.clinicId??'')===input.clinicId &&
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
        await refreshTransferState();
    } catch (e: any) {
        message.value = e.data?.message ?? e.data?.statusMessage ?? e.message ?? 'Unable to save.';
    } finally {
        busy.value = false;
    }
}
async function submit() {
    await run(async () => {
        if(modal.value==='assign-clinic'){if(!selected.value||!input.clinicId)throw new Error('Select a clinic.');return $fetch(`/api/surplus/lots/${selected.value.id}/clinic`,{method:'POST',headers:headers.value,body:{clinicId:input.clinicId,expectedVersion:selected.value.version}});}
        if (modal.value === 'forecast')
            return $fetch('/api/surplus/forecasts', {
                method: 'POST',
                headers: headers.value,
                body: { ...input, clinicId: input.clinicId || undefined, expectedUnits: Number(input.quantity), agencyId: Number(input.agencyId) },
            });
        if (modal.value === 'confirm')
            return $fetch('/api/surplus/forecasts', {
                method: 'POST',
                headers: headers.value,
                body: { ...input, clinicId: input.clinicId, quantity: Number(input.quantity), forecastId: forecast.value.id },
            });
        let lot = selected.value;
        if (modal.value === 'new' || modal.value === 'review')
            lot = await $fetch<SurplusLot>('/api/surplus/lots', {
                method: 'POST',
                headers: headers.value,
                body: report.value
                    ? {
                          agencyId: report.value.agency_id,
                          clinicId: input.clinicId || undefined,
                          formulaName: report.value.formula_name,
                          form: report.value.form,
                          flavor: report.value.flavor,
                          expirationDate: input.expirationDate,
                      }
                    : { ...input, clinicId: input.clinicId || undefined, agencyId: Number(input.agencyId) },
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
                ...(modal.value === 'review' ? {clinicId: input.clinicId} : {}),
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
                <p>View agency inventory and manage surplus counts. Reserve stock and send shipping details from a request’s Shipment section.</p>
            </div>
            <div v-if="reviewer && view==='counts'">
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
        <nav class="surplus-views" aria-label="Surplus views">
            <button class="button" :aria-pressed="view==='inventory'" @click="view='inventory'">Inventory</button>
            <button class="button" :aria-pressed="view==='transfers'" @click="view='transfers'">Transfers</button>
            <button class="button" :aria-pressed="view==='counts'" @click="view='counts'">Counts &amp; Forecasts</button>
        </nav>
        <section v-show="view==='transfers'" id="transfers">
            <h2>Transfers</h2>
            <p>{{reviewer?'Reserve stock, provide labels, and send shipping details in the request’s Shipment section.':'Confirm reserved product availability here. When CDPH/WIC provides shipping labels, arrange and confirm pickup.'}}</p>
            <p v-if="!data?.transfers?.length">No transfers yet.</p>
            <AgencyTransferShipment v-for="t in data?.transfers?.filter(t=>t.request_id)" :key="t.id" :transfer="t" :source-name="agencyName(t.source_agency_id)" :destination-name="agencyName(t.destination_agency_id)" :can-ship="data?.user.memberType==='agency' && data?.user.agencyId===t.source_agency_id" @updated="refreshTransferState" />
            <article
                v-for="t in data?.transfers?.filter(t=>!t.request_id)"
                :key="t.id"
                class="legacy-transfer"
            >
                <header class="legacy-transfer-heading"><div><strong>{{t.formula_name}} {{t.form==='concentrate'?'Concentrate':formulaFormLabel(t.form)}}</strong>
                <span class="legacy-transfer-route"><b>{{agencyName(t.source_agency_id)}}</b> → <b>{{agencyName(t.destination_agency_id)}}</b></span></div><span class="legacy-transfer-status">{{t.status==='received'?'Confirmed Receipt':t.status==='reserved'?'Transfer Requested':t.status==='shipped'?'In Transit':t.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span></header>
                <div class="legacy-transfer-summary"><span><strong>{{t.quantity}}</strong> unit(s)</span><span>Expires {{formatDisplayDate(t.expiration_date)}}</span><span>ETA {{t.eta?formatDisplayDate(t.eta):'Pending'}}</span><span v-if="t.request_ref">Ref {{t.request_ref}}</span></div>
                <p>{{t.source_clinic_name || 'Clinic not specified'}}</p><details><summary>Transfer details</summary><p v-if="pickupAddress(t.source_clinic_address)">Pickup: {{pickupAddress(t.source_clinic_address)}}</p>
                    <p v-if="t.tracking_reference">Tracking: {{t.tracking_reference}}</p>
                    <p>This transfer was recorded without a linked request. {{reviewer?'Cancel an unshipped reservation and reserve it again in the request’s Shipment section to use agency confirmation and shipping labels.':'Contact CDPH/WIC about this transfer.'}}</p>
                    <button v-if="reviewer && t.status==='reserved'" class="button" @click="start('cancel', data?.lots.find((l: any) => l.id === t.source_lot_id) as SurplusLot, t)">Cancel reservation</button>
                </details>
            </article>
        </section>
        <div v-show="view==='inventory'">
        <h2>Available inventory</h2>
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
            ><label>Clinic<select v-model="clinic"><option value="">All clinics</option><option value="unspecified">Clinic not specified</option><option v-for="[id,name] in clinicChoices" :key="id" :value="id">{{name}}</option></select></label><button
                class="button"
                @click="refresh()"
            >
                Refresh
            </button>
        </div>
        <p>
            Available unit(s) exclude reservations and expired stock. Reported counts require reconciliation; anticipated
            quantities become available only after agency confirmation and review.
        </p>
        <div class="table-scroll inventory-table-wrap">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>Agency / Formula</th>
                        <th>Expiration</th>
                        <th>On Hand</th>
                        <th>Reserved</th>
                        <th>Available</th>
                        <th><abbr title="Expired / Quarantined unit(s)">Expired /<br />Quarantined</abbr></th>
                        <th>Total</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="lot in lots"
                        :key="lot.id"
                    >
                        <td class="inventory-product">
                            <strong>{{ lot.formulaName }} {{ lot.form === 'concentrate' ? 'Concentrate' : formulaFormLabel(lot.form) }}</strong>
                            <span><template v-if="lot.flavor">{{ lot.flavor }} · </template>{{ agencyName(lot.agencyId) }}</span><span>{{lot.clinicName || 'Clinic not specified'}}</span>
                        </td>
                        <td>{{ formatDisplayDate(lot.expirationDate) }}</td>
                        <td>{{ lot.onHand }}</td>
                        <td>{{ lot.reserved }}</td>
                        <td class="inventory-available">{{ availableUnits(lot) }}</td>
                        <td>{{ lot.expiredUnits }}</td>
                        <td>{{ lot.onHand + lot.expiredUnits }}</td>
                        <td class="row-actions">
                            <button v-if="reviewer && availableUnits(lot)>0 && !lot.expiredUnits && lot.expirationDate>=localDate()" class="button button-secondary" @click="useInRequest(lot)">Use in Request</button>
                            <details class="inventory-actions"><summary>More</summary><div>
                                <button class="text-button" @click="showHistory(lot)">History</button><button v-if="!lot.clinicId &amp;&amp; !lot.reserved &amp;&amp; reviewer" class="text-button" @click="start('assign-clinic',lot)">Assign Clinic</button>
                                <template v-if="reviewer">
                                <button class="text-button" @click="start('reconcile',lot)">Reconcile count</button>
                                <button v-if="availableUnits(lot)>0" class="text-button" @click="start('deduct',lot)">Deduct stock</button>
                                <button v-if="lot.expiredUnits>0" class="text-button" @click="start('destroy',lot)">Record destruction</button>
                                <button class="text-button" @click="start('correct-expiry',lot)">Correct expiration</button>
                                </template>
                            </div></details>
                        </td>
                    </tr>
                    <tr v-if="!lots.length">
                        <td colspan="8">No matching inventory.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        </div>
        <section v-show="view==='counts'">
            <h2>Pending physical counts</h2>
            <p>Counts replace the verified balance after review; they are never added to it.</p>
            <article
                v-for="r in data?.reports.filter((r: any) => r.status === 'pending')"
                :key="r.id"
            >
                <strong>{{ agencyName(r.agency_id) }} · {{ r.formula_name }}</strong> · {{ formulaFormLabel(r.form) }} {{ r.flavor }} ·
                {{ r.reported_units }} unit(s) · expires {{ formatDisplayDate(r.expiration_date) }}
                <p>{{r.clinic_name || 'Clinic not specified'}}</p><p>Counted {{ r.counted_at }} by {{ r.confirmer_name }}. {{ r.reason }}</p>
                <button
                    v-if="reviewer"
                    class="button"
                    @click="start('review', undefined, r)"
                >
                    Review and reconcile
                </button>
            </article>
        </section>
        <section v-show="view==='counts'">
            <h2>Anticipated surplus</h2>
            <article
                v-for="f in data?.forecasts"
                :key="f.id"
            >
                <strong>{{ agencyName(f.agency_id) }} · {{ f.formula_name }}</strong> · {{ formulaFormLabel(f.form) }} {{ f.flavor }}
                <p>
                    {{f.clinic_name || 'Clinic not specified'}} · {{ f.expected_units }} anticipated unit(s) · confirmation due {{ formatDisplayDate(f.due_date) }} · {{ f.status }}
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
        <section v-if="view==='counts' && data?.user.role === 'admin'">
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
                                'assign-clinic': 'Assign Clinic',
                                new: 'Record physical count',
                                review: 'Reconcile reported count',
                                forecast: 'Anticipated surplus',
                                confirm: 'Confirm actual usable, uncommitted surplus',
                                destroy: 'Record verified destruction',
                                'correct-expiry': 'Correct verified expiration date',
                                reconcile: 'Reconcile physical count',
                                deduct: 'Deduct surplus',
                                'use-request': 'Use surplus in a Request',
                                cancel: 'Cancel reservation',
                                history: 'Inventory history',
                            } as any
                        )[modal]
                    }}
                </h2>
                <p v-if="selected">
                    {{ selected.formulaName }} · {{ selected.form }} {{ selected.flavor }} ·
                    {{ agencyName(selected.agencyId) }} · {{selected.clinicName || 'Clinic not specified'}}
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
                        {{ h.created_at }} · {{ h.kind }} · {{ h.quantity }} unit(s)
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
                <form v-else-if="modal==='use-request'" @submit.prevent="openShipment">
                    <p>Select a matching request. You’ll choose the quantity and reserve stock in its Shipment section.</p>
                    <p v-if="requestsLoading" role="status">Loading matching requests…</p>
                    <p v-else-if="requestChoiceError" role="alert">{{requestChoiceError}}</p>
                    <template v-else>
                        <label>Find request<input v-model="requestSearch" type="search" placeholder="Request number, participant, or receiving agency" /></label>
                        <label>Destination request<select v-model="destinationRequest" required><option disabled value="">Select a request</option><option v-for="r in matchingRequests" :key="r.id" :value="String(r.id)">#{{r.id}} · {{r.participantName}} · {{agencyName(r.agencyId)}}</option></select></label>
                        <p v-if="!matchingRequests.length">No matching requests. The request must include this formula and belong to a different agency.</p>
                    </template>
                    <div class="dialog-actions"><button class="button" type="button" @click="modal=''">Cancel</button><button class="button button-secondary" :disabled="requestsLoading || !matchingRequests.some(r=>String(r.id)===destinationRequest)" type="submit">Continue to Shipment</button></div>
                </form>
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
                    <label v-if="['new','forecast','review','confirm','assign-clinic'].includes(modal)">{{modal==='confirm'?'Actual storage clinic':'Storage clinic'}}<select v-model="input.clinicId" :required="modal==='assign-clinic'" :disabled="clinicStatus==='pending'"><option value="">Clinic not specified</option><option v-for="c in formClinics?.clinics" :key="c.id" :value="c.id">{{c.clinicName}}</option></select></label>
                    <p v-if="clinicError &amp;&amp; ['new','forecast','review','confirm','assign-clinic'].includes(modal)" role="alert">Clinics could not be loaded. Close and try again.</p>
                    <label
                        v-if="
                            ['new', 'reconcile', 'deduct', 'destroy', 'confirm', 'forecast'].includes(modal)
                        "
                        >{{ modal === 'forecast' ? 'Anticipated Unit(s)' : 'Unit(s)'
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
                        {{ proposedCountChange }} unit(s).
                    </p>
                    <p v-if="modal === 'review'">
                        Reported count: {{ report.reported_units }} unit(s), expires {{ formatDisplayDate(report.expiration_date) }}. Confirm
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
                    <label v-if="['deduct', 'destroy', 'forecast'].includes(modal)"
                        >Request / reference<input
                            v-model="input.requestRef"
                            required /></label
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
                    >
                    <p v-if="modal === 'destroy'">
                        Confirm these unit(s) have been physically destroyed and the Formula Destruction Form completed.
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
.legacy-transfer {box-sizing:border-box;display:grid;gap:8px;width:100%;max-width:var(--surplus-content-width);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:8px 0;font-size:13px;line-height:1.4;}
.legacy-transfer-heading {display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;}
.legacy-transfer-heading > div > strong {display:block;font-size:14px;line-height:1.4;}
.legacy-transfer-status {font-size:12px;line-height:1.4;font-weight:600;border:1px solid var(--line);border-radius:12px;padding:2px 8px;white-space:nowrap;}
.legacy-transfer-route {display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:4px;}
.legacy-transfer-route b {font-weight:600;}
.legacy-transfer-summary {display:grid;grid-template-columns:72px 144px 136px minmax(0,1fr);gap:4px 16px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
.legacy-transfer-summary strong {color:var(--text);}
.legacy-transfer p {margin:12px 0 0;font-size:13px;line-height:1.4;}
.legacy-transfer summary {font-size:13px;line-height:1.4;color:var(--muted);cursor:pointer;width:fit-content;}
@media(max-width:800px){.legacy-transfer-summary{grid-template-columns:repeat(2,minmax(0,1fr));}}

.surplus-views {display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 24px;}
.surplus-views .button,.surplus-filters .button {font-size:13px;line-height:1.4;padding:6px 12px;min-height:32px;}
.surplus-page h2 {font-size:20px;line-height:1.4;margin:0 0 12px;}
#transfers {margin-top:0;}
#transfers > p {font-size:13px;line-height:1.4;margin:0 0 16px;}
.surplus-views .button[aria-pressed="true"] {background:var(--purple);color:white;border-color:var(--purple);}
.inventory-actions {margin-top:8px;font-size:13px;}
.inventory-actions summary {cursor:pointer;}
.inventory-actions > div {display:grid;gap:10px;padding-top:10px;justify-items:start;}

.surplus-page {
    --surplus-content-width:1120px;
    padding: 24px;
}
.surplus-page :deep(.transfer-labels) {margin-top:12px;padding-top:12px;}
.surplus-page :deep(.transfer-labels h4) {font-size:13px;line-height:1.4;margin:0 0 8px;}
.surplus-page :deep(.transfer-labels p) {font-size:13px;line-height:1.4;margin:8px 0 0;}
.surplus-page :deep(.pickup-instructions) {font-size:13px;line-height:1.4;padding:12px;margin-top:12px;}
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
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0 8px;
}
.surplus-filters label {margin:0;gap:4px;font-size:13px;}
.surplus-filters input {width:240px;}
.surplus-filters :is(input,select) {padding:6px 10px;font-size:13px;line-height:1.4;min-height:32px;box-sizing:border-box;}
.inventory-table-wrap {max-width:var(--surplus-content-width);}
.inventory-table {width:auto;min-width:880px;font-size:13px;}
.inventory-table :is(th,td) {padding:10px 12px;vertical-align:middle;line-height:1.4;}
.inventory-table th {font-size:12px;white-space:nowrap;line-height:1.3;}
.inventory-table th abbr {text-decoration:none;}
.inventory-table :is(th,td):nth-child(n+3):nth-child(-n+7) {text-align:right;font-variant-numeric:tabular-nums;}
.inventory-table .inventory-product {min-width:230px;max-width:310px;}
.inventory-product strong {display:block;font-size:14px;line-height:1.4;}
.inventory-product span {display:block;color:var(--muted);font-size:12px;line-height:1.4;margin-top:4px;}
.inventory-available {font-weight:700;}
.inventory-table .row-actions {min-width:165px;white-space:nowrap;}
.inventory-table .row-actions .button {margin:0 8px 0 0;padding:6px 10px;font-size:13px;line-height:1.4;min-height:32px;}
.inventory-table .inventory-actions {display:inline-block;margin:0;position:relative;font-size:13px;line-height:1.4;}
.inventory-table .inventory-actions > div {min-width:150px;padding:10px 0 2px;white-space:normal;}
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
