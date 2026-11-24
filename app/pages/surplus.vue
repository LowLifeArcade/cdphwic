<script setup lang="ts">
import {unitLabel} from '~/../shared/quantityLabels';
import {formatDisplayDate,formulaFormLabel} from '~/../shared/requestPresentation';
import { isReviewer, availableUnits, localDate, daysRemaining, surplusDisposition, variantKey, surplusCatalogVariants } from '~/../shared/surplus';
import {surplusShipmentDraft} from '~/../shared/requestTransfers';
import {formatClinic,type ClinicAddress,type ClinicRecord} from '~/../shared/shipping';
import {groupSurplusLots} from '~/../shared/surplusInventoryGroups';
import {surplusMovementReason} from '~/../shared/surplusMovement';
import type {ProductRecord,RequestRecord} from '~/../shared/domain';
import type { SurplusLot } from '~/../shared/surplus';
function formatInventoryDate(value?: string | null) {
    return formatDisplayDate(value?.slice(0, 10)).replace(/^(\d{2}-\d{2}-)\d{2}(\d{2})$/, '$1$2');
}
function pickupAddress(json?:string|null){try{const value=JSON.parse(json??'null') as ClinicAddress|null;return value?formatClinic(value):'';}catch{return '';}}
function dayAfter(date:string){return new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);}
function movementLabel(kind:string){return ({reconcile:'Physical count','correct-entry':'Correction',deduct:'Stock adjustment',reserve:'Reservation',release:'Reservation released','request-issue':'Participant issue',ship:'Shipment',receive:'Receipt',cancel:'Cancellation',expire:'Expiration'} as Record<string,string>)[kind]??kind;}
const route = useRoute();
const view=ref<'inventory'|'transfers'>(route.query.transfer?'transfers':'inventory');
watch(()=>route.query.transfer,id=>{if(id)view.value='transfers';});
const requestChoices=ref<RequestRecord[]>([]);
const requestsLoading=ref(false);
const requestChoiceError=ref('');
const destinationRequest=ref('');
const requestSearch=ref('');
const searchableRequests=computed(()=>{const query=requestSearch.value.trim().toLowerCase();return requestChoices.value.filter(r=>!query||`${r.id} ${r.submissionId??''} ${r.participantName} ${agencyName(r.agencyId)}`.toLowerCase().includes(query));});
const matchingRequests=computed(()=>selected.value?searchableRequests.value.filter(r=>surplusShipmentDraft(r,selected.value!,[])):[]);
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
const { data, refresh, error, status } = await useFetch('/api/surplus', {
    headers,
    server: false,
    watch: [identity],
    retry: 2,
    retryDelay: 500,
});
const {data:productData, error:productError}=await useFetch<{products:ProductRecord[]}>('/api/products');
const surplusVariants=computed(()=>surplusCatalogVariants(productData.value?.products??[]));
const surplusFormulaNames=computed(()=>[...new Map(surplusVariants.value.map(variant=>[variant.formulaName.toLowerCase(),variant.formulaName])).values()]);
const formulaSearch=ref('');
const filteredSurplusFormulaNames=computed(()=>{const query=formulaSearch.value.trim().toLowerCase();return surplusFormulaNames.value.filter(name=>!query||name.toLowerCase().includes(query));});
const surplusAvailableForms=computed(()=>[...new Set(surplusVariants.value.filter(variant=>variant.formulaName===input.formulaName).map(variant=>variant.form))]);
const surplusAvailableFlavors=computed(()=>[...new Set(surplusVariants.value.filter(variant=>variant.formulaName===input.formulaName&&variant.form===input.form).map(variant=>variant.flavor))]);
const surplusAvailablePackagings=computed(()=>[...new Set(surplusVariants.value.filter(variant=>variant.formulaName===input.formulaName&&variant.form===input.form&&variant.flavor===input.flavor).flatMap(variant=>variant.packagings).filter(Boolean))]);
const selectedSurplusFlavor=ref('__unselected__');
const correctedVariantSelection=ref('');
function variantSelectionKey(variant:{formulaName:string;form:string;flavor:string}){return JSON.stringify([variant.formulaName,variant.form,variant.flavor]);}
function selectCorrectedVariant(key:string){const variant=surplusVariants.value.find(item=>variantSelectionKey(item)===key);if(!variant)return;input.correctedFormulaName=variant.formulaName;input.correctedForm=variant.form;input.correctedFlavor=variant.flavor;}
function selectSurplusFormula(name:string){input.formulaName=name;formulaSearch.value=name;input.form='';input.flavor='';input.packaging='';selectedSurplusFlavor.value='__unselected__';}
function updateSurplusFormulaSearch(){input.formulaName='';input.form='';input.flavor='';input.packaging='';selectedSurplusFlavor.value='__unselected__';}
function selectSurplusForm(){input.flavor='';input.packaging='';selectedSurplusFlavor.value='__unselected__';}
function selectSurplusFlavor(value:string){input.flavor=value==='__unselected__'||value==='__unflavored__'?'':value;input.packaging=surplusAvailablePackagings.value.length===1?surplusAvailablePackagings.value[0]:'';}
function initializeSurplusCatalogSelection(){
 const formula=surplusFormulaNames.value.find(name=>name.toLowerCase()===input.formulaName.trim().toLowerCase());
 if(!formula){input.formulaName='';formulaSearch.value='';input.form='';input.flavor='';input.packaging='';selectedSurplusFlavor.value='__unselected__';return;}
 input.formulaName=formula;
 formulaSearch.value=formula;
 input.form='';input.flavor='';input.packaging='';selectedSurplusFlavor.value='__unselected__';
}
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
const pendingAgencyCounts=computed(()=>data.value?.reports.filter((report:any)=>report.status==='pending')??[]);
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
                `${l.formulaName} ${l.flavor} ${l.form} ${l.packaging??''}`.toLowerCase().includes(search.value.trim().toLowerCase())),
    ),
);
function inventoryLotIsArchived(lot:SurplusLot){return lot.onHand===0&&lot.expiredUnits===0;}
const archivedLots=computed(()=>lots.value.filter(inventoryLotIsArchived).sort((a,b)=>b.expirationDate.localeCompare(a.expirationDate)||a.formulaName.localeCompare(b.formulaName)));
const dispositionLots = computed(() => lots.value.filter(lot => !inventoryLotIsArchived(lot)));
const lotDisposition = (lot: SurplusLot) => surplusDisposition(lot.expirationDate, localDate());
const activeLots = computed(() => dispositionLots.value.filter(lot => !lotDisposition(lot)));
const dispositionSections = computed(() => [
    { title: 'Donation', description: '45–60 days remaining. Arrange donation of surplus stock.', lots: dispositionLots.value.filter(lot => lotDisposition(lot) === 'donation') },
    { title: 'Expired', description: 'Fewer than 45 days remaining. Destroy the stock and record verified destruction.', lots: dispositionLots.value.filter(lot => lotDisposition(lot) === 'destruction') },
]);
const expandedInventoryGroups=ref<Record<string,boolean>>({});
const inventoryRows=computed(()=>groupSurplusLots(activeLots.value).flatMap(group=>group.lots.length===1
 ? [{kind:'lot' as const,key:`lot:${group.lots[0]!.id}`,group,lot:group.lots[0]!}]
 : [{kind:'group' as const,key:`group:${group.key}`,group},...(expandedInventoryGroups.value[group.key]?group.lots.map(lot=>({kind:'lot' as const,key:`lot:${lot.id}`,group,lot})):[])]));
function toggleInventoryGroup(key:string){expandedInventoryGroups.value[key]=!expandedInventoryGroups.value[key];}
function moveSurplusTab(event:KeyboardEvent){
    const tabs=['inventory','transfers'] as const;
    const current=tabs.indexOf(view.value);
    const next=event.key==='ArrowRight'?tabs[(current+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(current+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:undefined;
    if(!next)return;
    event.preventDefault();
    view.value=next;
    nextTick(()=>document.getElementById(`${next}-tab`)?.focus());
}
const agencyName = (id: number) => agencyData.value?.agencies.find((a) => a.id === id)?.name ?? `Agency ${id}`;
function transferFormulaDisplay(transfer:any){return [transfer.formula_name,transfer.form==='concentrate'?'Concentrate':formulaFormLabel(transfer.form),transfer.flavor,transfer.packaging].filter(Boolean).join(' ');}
const transferRows=computed(()=>data.value?.transfers??[]);
const sendingTransfers=computed(()=>transferRows.value.filter(t=>!['cancelled','received'].includes(t.status)&&(data.value?.user.memberType!=='agency'||t.source_agency_id===data.value?.user.agencyId)));
const receivingTransfers=computed(()=>transferRows.value.filter(t=>!['cancelled','received'].includes(t.status)&&(data.value?.user.memberType!=='agency'||t.destination_agency_id===data.value?.user.agencyId)));
const archivedTransfers=computed(()=>transferRows.value.filter(t=>t.status==='cancelled'&&(data.value?.user.memberType!=='agency'||t.source_agency_id===data.value?.user.agencyId||t.destination_agency_id===data.value?.user.agencyId)));
const completedTransfers=computed(()=>transferRows.value.filter(t=>t.status==='received'&&(data.value?.user.memberType!=='agency'||t.source_agency_id===data.value?.user.agencyId||t.destination_agency_id===data.value?.user.agencyId)));
const operationId = ref('');
const modal = ref('');
const modalTitles:Record<string,string>={'edit-inventory':'Edit Inventory', 'assign-clinic':'Assign Clinic',new:'Record physical count',review:'Review reported count',forecast:'Anticipated Surplus',confirm:'Confirm actual usable, uncommitted surplus',donate:'Record formula donation',destroy:'Record verified destruction','correct-entry':'Correct inventory entry','correct-expiry':'Correct verified expiration date',reconcile:'Update physical count',deduct:'Deduct surplus','use-request':'Use in Request',cancel:'Cancel reservation',history:'Inventory History'};
const modalTitle=computed(()=>modal.value==='new'&&!reviewer.value?'Record Surplus':modalTitles[modal.value]??'');
const selected = ref<SurplusLot>();
const report = ref<any>();
const forecast = ref<any>();
const transfer = ref<any>();
const correctionTarget=ref<any>();
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
    correctedFormulaName:'',
    correctedForm:'',
    correctedFlavor:'',
    correctedExpirationDate:'',
    form: 'powder',
    flavor: '',
    packaging: '',
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
    correctionTarget.value=undefined;
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
        formulaName: ['new','forecast'].includes(kind)?String(route.query.formula??''):input.formulaName,
        form: '',
        flavor: '',
        packaging: '',
        trackingReference: '',
    });
    selectedSurplusFlavor.value='__unselected__';
    if(['new','forecast'].includes(kind))initializeSurplusCatalogSelection();
    if(kind==='new'&&!reviewer.value)input.agencyId=data.value?.user.agencyId??0;
    if(kind==='donate')input.reason='Donation';
    if(kind==='correct-entry'){
        correctionTarget.value=item;
        const match=surplusVariants.value.find(variant=>variant.formulaName.toLowerCase()===String(lot?.formulaName??'').toLowerCase()&&variant.form===lot?.form&&(variant.flavor??'').toLowerCase()===(lot?.flavor??'').toLowerCase());
        correctedVariantSelection.value=match?variantSelectionKey(match):'';
        input.quantity=item?.effective_quantity??item?.quantity??0;
        input.correctedFormulaName=lot?.formulaName??'';
        input.correctedForm=lot?.form??'';
        input.correctedFlavor=lot?.flavor??'';
        input.correctedExpirationDate=lot?.expirationDate??'';
    }
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
const openedForecastId=ref('');
watch([()=>route.query.forecast,()=>data.value?.forecasts],async([queryId,forecasts])=>{
    const id=typeof queryId==='string'?queryId:'';
    if(!id||openedForecastId.value===id||!forecasts)return;
    const item=(forecasts as any[]).find(f=>f.id===id);
    if(!item)return;
    openedForecastId.value=id;
    view.value='inventory';
    start('confirm',undefined,item);
},{immediate:true,flush:'post'});
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
    const returnToHistory=modal.value==='correct-entry';
    const historyLot=selected.value;
    try {
        await work();
        if(returnToHistory&&historyLot){
            modal.value='history';
            await refreshTransferState();
            const refreshedLot=((data.value?.lots??[]) as SurplusLot[]).find(lot=>lot.id===historyLot.id);
            if(refreshedLot)selected.value=refreshedLot;
            history.value=await $fetch<any[]>('/api/surplus/history',{headers:headers.value,query:{lotId:historyLot.id}});
        }else{
            modal.value = '';
            await refreshTransferState();
        }
    } catch (e: any) {
        message.value = e.data?.message ?? e.data?.statusMessage ?? e.message ?? 'Unable to save.';
    } finally {
        busy.value = false;
    }
}
const recordedSurplusAction = computed(() => {
    if (modal.value !== 'new' || reviewer.value || !input.expirationDate) return '';
    const disposition = surplusDisposition(input.expirationDate, localDate());
    if (disposition === 'destruction') return 'Destruction required. Destroy this formula, then record verified destruction.';
    if (disposition === 'donation') return 'Donation required. Arrange donation of this formula and record the donation.';
    return '';
});
async function submit() {
    await run(async () => {
        if(modal.value==='assign-clinic'){if(!selected.value||!input.clinicId)throw new Error('Select a clinic.');return $fetch(`/api/surplus/lots/${selected.value.id}/clinic`,{method:'POST',headers:headers.value,body:{clinicId:input.clinicId,expectedVersion:selected.value.version}});}
        if(modal.value==='correct-entry'){
            if(!selected.value||!correctionTarget.value)throw new Error('Select a history entry to correct.');
            return $fetch('/api/surplus/commands',{method:'POST',headers:headers.value,body:{operationId:operationId.value,kind:'correct-entry',correctionOf:correctionTarget.value.id,lotId:selected.value.id,quantity:Number(input.quantity),correctedFormulaName:input.correctedFormulaName,correctedForm:input.correctedForm,correctedFlavor:input.correctedFlavor,correctedExpirationDate:input.correctedExpirationDate,reason:input.reason,confirmerName:input.confirmerName,date:input.date,expectedVersion:selected.value.version}});
        }
        if(modal.value==='new'&&!reviewer.value)
            return $fetch('/api/surplus/counts',{method:'POST',headers:headers.value,body:{operationId:operationId.value,formulaName:input.formulaName,form:input.form,flavor:input.flavor==='__unflavored__'?'':input.flavor,packaging:input.packaging,clinicId:input.clinicId||undefined,quantity:Number(input.quantity),expirationDate:input.expirationDate,date:input.date,confirmerName:input.confirmerName,reason:input.reason}});
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
                          packaging: report.value.packaging??'',
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
                    : ['destroy','donate'].includes(modal.value)
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
        </div>
        <p
            v-if="status === 'error' && !data"
            role="alert"
        >
            Inventory could not be loaded<span v-if="error?.statusCode"> (HTTP {{ error.statusCode }})</span>.
            <button class="text-button" type="button" @click="refresh()">Retry</button>
        </p>
        <p
            v-if="message"
            role="status"
        >
            {{ message }}
        </p>
        <div class="surplus-views" role="tablist" aria-label="Formula Surplus sections">
            <button id="inventory-tab" class="surplus-tab" role="tab" :aria-selected="view==='inventory'" :tabindex="view==='inventory'?0:-1" aria-controls="inventory-panel" @keydown="moveSurplusTab" @click="view='inventory'">Inventory</button>
            <button id="transfers-tab" class="surplus-tab" role="tab" :aria-selected="view==='transfers'" :tabindex="view==='transfers'?0:-1" aria-controls="transfers-panel" @keydown="moveSurplusTab" @click="view='transfers'">Transfers</button>
        </div>
        <section v-show="view==='transfers'" id="transfers-panel" role="tabpanel" aria-labelledby="transfers-tab" tabindex="0">
            <h2>Transfers</h2>
            <p>{{reviewer?'Reserve stock, provide labels, and send shipping details in the request’s Shipment section.':'Confirm reserved product availability here. When CDPH/WIC provides shipping labels, arrange and confirm pickup.'}}</p>
            <p v-if="!transferRows.length">No transfers yet.</p>
            <section class="transfer-direction" aria-labelledby="sending-transfers-heading">
                <header class="transfer-direction-heading"><h3 id="sending-transfers-heading">Sending</h3><span>{{sendingTransfers.length}}</span></header>
                <p v-if="!sendingTransfers.length" class="muted-copy">No transfers to send.</p>
                <AgencyTransferShipment v-for="t in sendingTransfers.filter(t=>t.request_id)" :key="`send:${t.id}`" :transfer="t" :source-name="agencyName(t.source_agency_id)" :destination-name="agencyName(t.destination_agency_id)" :can-ship="data?.user.memberType==='agency' && data?.user.agencyId===t.source_agency_id" @updated="refreshTransferState" />
                <details v-for="t in sendingTransfers.filter(t=>!t.request_id)" :key="`send-legacy:${t.id}`" class="legacy-transfer" :class="{'transfer-cancelled':t.status==='cancelled'}">
                    <summary class="legacy-transfer-summary-row"><strong>{{transferFormulaDisplay(t)}}</strong><span>{{agencyName(t.source_agency_id)}} → {{agencyName(t.destination_agency_id)}}</span><span class="legacy-transfer-status">{{t.status==='received'?'Confirmed Receipt':t.status==='reserved'?'Transfer Requested':t.status==='shipped'?'In Transit':t.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span></summary>
                    <div class="legacy-transfer-summary"><span><strong>{{t.quantity}}</strong> {{unitLabel(t.quantity)}}</span><span>Expires {{formatDisplayDate(t.expiration_date)}}</span><span>ETA {{t.eta?formatDisplayDate(t.eta):'Pending'}}</span><span v-if="t.request_ref">Ref {{t.request_ref}}</span></div>
                    <p>{{t.source_clinic_name || 'Clinic not specified'}}</p><p v-if="pickupAddress(t.source_clinic_address)">Pickup: {{pickupAddress(t.source_clinic_address)}}</p><p v-if="t.tracking_reference">Tracking: {{t.tracking_reference}}</p>
                    <p>This transfer was recorded without a linked request. {{reviewer?'Cancel an unshipped reservation and reserve it again in the request’s Shipment section to use agency confirmation and shipping labels.':'Contact CDPH/WIC about this transfer.'}}</p>
                    <button v-if="reviewer && t.status==='reserved'" class="button" @click="start('cancel', data?.lots.find((l: any) => l.id === t.source_lot_id) as SurplusLot, t)">Cancel reservation</button>
                </details>
            </section>
            <section class="transfer-direction" aria-labelledby="receiving-transfers-heading">
                <header class="transfer-direction-heading"><h3 id="receiving-transfers-heading">Receiving</h3><span>{{receivingTransfers.length}}</span></header>
                <p v-if="!receivingTransfers.length" class="muted-copy">No transfers to receive.</p>
                <AgencyTransferShipment v-for="t in receivingTransfers.filter(t=>t.request_id)" :key="`receive:${t.id}`" :transfer="t" :source-name="agencyName(t.source_agency_id)" :destination-name="agencyName(t.destination_agency_id)" :can-ship="false" @updated="refreshTransferState" />
                <details v-for="t in receivingTransfers.filter(t=>!t.request_id)" :key="`receive-legacy:${t.id}`" class="legacy-transfer" :class="{'transfer-cancelled':t.status==='cancelled'}">
                    <summary class="legacy-transfer-summary-row"><strong>{{transferFormulaDisplay(t)}}</strong><span>{{agencyName(t.source_agency_id)}} → {{agencyName(t.destination_agency_id)}}</span><span class="legacy-transfer-status">{{t.status==='received'?'Confirmed Receipt':t.status==='reserved'?'Transfer Requested':t.status==='shipped'?'In Transit':t.status==='cancelled'?'Cancelled':'Blocked — expired'}}</span></summary>
                    <div class="legacy-transfer-summary"><span><strong>{{t.quantity}}</strong> {{unitLabel(t.quantity)}}</span><span>Expires {{formatDisplayDate(t.expiration_date)}}</span><span>ETA {{t.eta?formatDisplayDate(t.eta):'Pending'}}</span><span v-if="t.request_ref">Ref {{t.request_ref}}</span></div>
                    <p>{{t.source_clinic_name || 'Clinic not specified'}}</p><p v-if="pickupAddress(t.source_clinic_address)">Pickup: {{pickupAddress(t.source_clinic_address)}}</p><p v-if="t.tracking_reference">Tracking: {{t.tracking_reference}}</p>
                </details>
            </section>
            <details v-if="completedTransfers.length" class="transfer-archive">
                <summary>Completed ({{completedTransfers.length}})</summary>
                <details v-for="t in completedTransfers" :key="`completed:${t.id}`" class="legacy-transfer completed-transfer-row">
                    <summary class="legacy-transfer-summary-row"><strong>{{transferFormulaDisplay(t)}}</strong><span>{{agencyName(t.source_agency_id)}} → {{agencyName(t.destination_agency_id)}}</span><span class="legacy-transfer-status completed-transfer-status">Confirmed Receipt</span><span class="archived-transfer-quantity">{{t.quantity}} {{unitLabel(t.quantity)}}</span></summary>
                    <div class="legacy-transfer-summary"><span>Exp {{formatDisplayDate(t.expiration_date)}}</span><span>ETA {{t.eta?formatDisplayDate(t.eta):'—'}}</span><span v-if="t.request_id">Request #{{t.request_id}}</span><span v-else-if="t.request_ref">Ref {{t.request_ref}}</span><span v-if="t.shipped_date">Picked up {{formatDisplayDate(t.shipped_date)}}</span></div>
                    <p>{{t.source_clinic_name || 'Clinic not specified'}}</p><p v-if="pickupAddress(t.source_clinic_address)">Pickup: {{pickupAddress(t.source_clinic_address)}}</p><p v-if="t.tracking_reference">Tracking: {{t.tracking_reference}}</p>
                    <NuxtLink v-if="t.request_id && reviewer" class="text-button" :to="{path:'/requests',query:{request:t.request_id},hash:`#shipments-${t.request_id}`}">Open Request Shipment</NuxtLink>
                </details>
            </details>
            <details v-if="archivedTransfers.length" class="transfer-archive">
                <summary>Archived · Cancelled ({{archivedTransfers.length}})</summary>
                <details v-for="t in archivedTransfers" :key="`archived:${t.id}`" class="legacy-transfer transfer-cancelled archived-transfer-row">
                    <summary class="legacy-transfer-summary-row"><strong>{{transferFormulaDisplay(t)}}</strong><span>{{agencyName(t.source_agency_id)}} → {{agencyName(t.destination_agency_id)}}</span><span class="legacy-transfer-status">Cancelled</span><span class="archived-transfer-quantity">{{t.quantity}} {{unitLabel(t.quantity)}}</span></summary>
                    <div class="legacy-transfer-summary"><span>Exp {{formatDisplayDate(t.expiration_date)}}</span><span>ETA {{t.eta?formatDisplayDate(t.eta):'—'}}</span><span v-if="t.request_id">Request #{{t.request_id}}</span><span v-else-if="t.request_ref">Ref {{t.request_ref}}</span></div>
                    <p>{{t.source_clinic_name || 'Clinic not specified'}}</p><p v-if="pickupAddress(t.source_clinic_address)">Pickup: {{pickupAddress(t.source_clinic_address)}}</p><p v-if="t.tracking_reference">Tracking: {{t.tracking_reference}}</p>
                    <NuxtLink v-if="t.request_id && reviewer" class="text-button" :to="{path:'/requests',query:{request:t.request_id},hash:`#shipments-${t.request_id}`}">Open Request Shipment</NuxtLink>
                </details>
            </details>
        </section>
        <div v-show="view==='inventory'" id="inventory-panel" role="tabpanel" aria-labelledby="inventory-tab" tabindex="0">
        <header class="inventory-section-heading">
            <h2>Available Inventory</h2>
            <button v-if="data && !reviewer" class="button" type="button" @click="start('new')">Record Surplus</button>
        </header>
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
            Available Units exclude reservations and expired stock. Agency-attested counts become available immediately;
            pending reports require reconciliation, and anticipated quantities become available after agency confirmation and review.
        </p>
        <div class="table-scroll inventory-table-wrap">
            <table class="inventory-table">
                <colgroup>
                    <col class="inventory-formula-column" />
                    <col class="inventory-date-column" span="2" />
                    <col class="inventory-count-column" span="4" />
                    <col class="inventory-action-column" />
                </colgroup>
                <thead>
                    <tr>
                        <th>Agency / Formula</th>
                        <th>Expiration</th>
                        <th>Date Recorded</th>
                        <th>On Hand</th>
                        <th>Reserved</th>
                        <th>Available</th>
                        <th>Total</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in inventoryRows" :key="row.key" :class="row.kind==='group'?'inventory-group-row':row.group.lots.length>1?'inventory-lot-detail':''">
                        <template v-if="row.kind==='group'">
                            <td class="inventory-product"><strong>{{row.group.formulaName}} {{row.group.form==='concentrate'?'Concentrate':formulaFormLabel(row.group.form)}}</strong><span v-if="row.group.flavor || row.group.packaging">{{[row.group.flavor,row.group.packaging].filter(Boolean).join(' · ')}}</span><span v-if="reviewer">{{agencyName(row.group.agencyId)}}</span><span>{{row.group.clinicName||'Clinic not specified'}}</span><small v-if="row.group.expiredUnits" class="inventory-quarantine">Quarantined: {{ row.group.expiredUnits }}</small></td>
                            <td>
                                <strong class="inventory-expiration">{{ formatInventoryDate(row.group.earliestExpiration) }}</strong>
                                <small class="inventory-expiration-summary">Earliest of {{ row.group.lots.length }}</small>
                            </td>
                            <td>See lots</td>
                            <td><strong class="inventory-quantity">{{row.group.onHand}}</strong></td><td><strong class="inventory-quantity">{{row.group.reserved}}</strong></td><td class="inventory-available"><strong>{{row.group.available}}</strong></td><td><strong class="inventory-quantity">{{row.group.total}}</strong></td>
                            <td class="row-actions"><button class="button" type="button" :aria-expanded="!!expandedInventoryGroups[row.group.key]" @click="toggleInventoryGroup(row.group.key)">{{expandedInventoryGroups[row.group.key]?'Hide':'View'}} {{row.group.lots.length}} expiration lots</button></td>
                        </template>
                        <template v-else>
                            <td class="inventory-product"><template v-if="row.group.lots.length===1"><strong>{{row.group.formulaName}} {{row.group.form==='concentrate'?'Concentrate':formulaFormLabel(row.group.form)}}</strong><span v-if="row.group.flavor || row.group.packaging">{{[row.group.flavor,row.group.packaging].filter(Boolean).join(' · ')}}</span><span v-if="reviewer">{{agencyName(row.group.agencyId)}}</span><span>{{row.group.clinicName||'Clinic not specified'}}</span></template><span v-else class="inventory-lot-label">Expiration lot</span><small v-if="row.lot.expiredUnits" class="inventory-quarantine">Quarantined: {{ row.lot.expiredUnits }}</small></td>
                            <td><strong class="inventory-expiration">{{formatInventoryDate(row.lot.expirationDate)}}</strong></td><td>{{formatInventoryDate(row.lot.recordedAt)}}</td><td><strong class="inventory-quantity">{{row.lot.onHand}}</strong></td><td><strong class="inventory-quantity">{{row.lot.reserved}}</strong></td><td class="inventory-available"><strong>{{availableUnits(row.lot)}}</strong></td><td><strong class="inventory-quantity">{{row.lot.onHand+row.lot.expiredUnits}}</strong></td>
                            <td class="row-actions">
                                <button v-if="reviewer && availableUnits(row.lot)>0 && !row.lot.expiredUnits && daysRemaining(row.lot.expirationDate,localDate())>60" class="button button-secondary" @click="useInRequest(row.lot)">Use in Request</button>
                                <button class="text-button" type="button" @click="start('edit-inventory',row.lot)">Edit</button>
                            </td>
                        </template>
                    </tr>
                    <tr v-if="!inventoryRows.length">
                        <td colspan="8"><span v-if="status==='pending'&&!data">Loading inventory…</span><span v-else-if="status==='success'">No matching inventory.</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <section v-for="section in dispositionSections" :key="section.title" class="inventory-archive">
            <h2>{{ section.title }}</h2>
            <p>{{ section.description }}</p>
            <p v-if="status === 'success' && !section.lots.length">No matching lots.</p>
            <article v-for="lot in section.lots" :key="lot.id" class="inventory-archive-row inventory-disposition-row">
                <div>
                    <strong>{{ lot.formulaName }} {{ formulaFormLabel(lot.form) }}</strong>
                    <small>{{ [lot.flavor, lot.packaging, reviewer ? agencyName(lot.agencyId) : '', lot.clinicName || 'Clinic not specified'].filter(Boolean).join(' · ') }}</small>
                </div>
                <div>Expiration <strong>{{ formatInventoryDate(lot.expirationDate) }}</strong></div>
                <div>Date Recorded <strong>{{ formatInventoryDate(lot.recordedAt) }}</strong></div>
                <div>Total <strong>{{ lot.onHand + lot.expiredUnits }}</strong></div>
                <div>Reserved <strong>{{ lot.reserved }}</strong></div>
                <div class="inventory-archive-actions">
                    <button class="text-button" type="button" @click="start('edit-inventory',lot)">Edit</button>
                </div>
            </article>
        </section>
        <details v-if="archivedLots.length" class="inventory-archive">
            <summary>Archived depleted lots ({{archivedLots.length}})</summary>
            <p class="muted-copy">These lots have no remaining physical stock. Open a lot’s history if you need to review its inventory changes.</p>
            <article v-for="lot in archivedLots" :key="lot.id" class="inventory-archive-row">
                <div><strong>{{lot.formulaName}} {{lot.form==='concentrate'?'Concentrate':formulaFormLabel(lot.form)}}</strong><small v-if="lot.flavor || lot.packaging">{{[lot.flavor,lot.packaging].filter(Boolean).join(' · ')}}</small><small>{{lot.clinicName||'Clinic not specified'}}<template v-if="reviewer"> · {{agencyName(lot.agencyId)}}</template></small></div>
                <div><span>Exp</span><strong>{{formatInventoryDate(lot.expirationDate)}}</strong></div>
                <div><span>Total</span><strong>{{lot.onHand+lot.expiredUnits}}</strong></div>
                <div class="inventory-archive-actions"><button class="text-button" type="button" @click="showHistory(lot)">History</button><button class="text-button" type="button" @click="start('edit-inventory',lot)">Edit</button></div>
            </article>
        </details>
        <section v-if="reviewer" class="surplus-counts-section" aria-labelledby="counts-heading">
        <header class="surplus-counts-heading">
            <h2 id="counts-heading">Counts &amp; Forecasts</h2>
            <div v-if="data" class="counts-actions">
            <button v-if="reviewer" class="button button-main" @click="start('forecast')">Anticipated Surplus</button>
            </div>
        </header>
        <section v-if="pendingAgencyCounts.length">
            <h2>Pending Agency Counts for Review</h2>
            <p>These counts were submitted by Local Agencies and await CDPH/WIC review before they update available inventory.</p>
            <article
                v-for="r in pendingAgencyCounts"
                :key="r.id"
            >
                <strong>{{ agencyName(r.agency_id) }} · {{ r.formula_name }}</strong> · {{ formulaFormLabel(r.form) }} {{ r.flavor }}<template v-if="r.packaging"> · {{r.packaging}}</template> ·
                {{ r.reported_units }} {{unitLabel(r.reported_units)}} · expires {{ formatDisplayDate(r.expiration_date) }}
                <p>{{r.clinic_name || 'Clinic not specified'}}</p><p>Counted {{ formatDisplayDate(r.counted_at) }} by {{ r.confirmer_name }}. {{ r.reason }}</p>
                <button
                    v-if="reviewer"
                    class="button"
                    @click="start('review', undefined, r)"
                >
                    Review count
                </button>
            </article>
        </section>
        <section>
            <h2>Anticipated Surplus</h2>
            <article
                v-for="f in data?.forecasts"
                :key="f.id"
            >
                <strong>{{ agencyName(f.agency_id) }} · {{ f.formula_name }}</strong> · {{ formulaFormLabel(f.form) }} {{ f.flavor }}<template v-if="f.packaging"> · {{f.packaging}}</template>
                <p>
                    {{f.clinic_name || 'Clinic not specified'}} · {{ f.expected_units }} anticipated {{unitLabel(f.expected_units)}} · confirmation due {{ formatDisplayDate(f.due_date) }} · {{ f.status }}
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
        </section>
        </div>
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
                <h2 id="surplus-dialog-title">{{modalTitle}}</h2>
                <p v-if="selected && !['history','edit-inventory','use-request'].includes(modal)">
                    {{ selected.formulaName }} · {{ selected.form }} {{ selected.flavor }}<template v-if="selected.packaging"> · {{selected.packaging}}</template> ·
                    {{ agencyName(selected.agencyId) }} · {{selected.clinicName || 'Clinic not specified'}}
                </p>
                <p
                    v-if="message"
                    role="alert"
                >
                    {{ message }}
                </p>
                <div v-if="modal === 'history'">
                    <div v-if="selected" class="history-product">
                        <strong>{{[selected.formulaName,formulaFormLabel(selected.form),selected.flavor,selected.packaging].filter(Boolean).join(' ')}}</strong>
                        <span>{{agencyName(selected.agencyId)}} · {{selected.clinicName || 'Clinic not specified'}}</span>
                    </div>
                    <p v-if="!history.length" class="history-empty">No inventory history for this lot yet.</p>
                    <article
                        class="history-entry"
                        v-for="h in history"
                        :key="h.id"
                    >
                        <header class="history-entry-heading">
                            <div><strong>{{formatDisplayDate(h.created_at)}}</strong><span>{{movementLabel(h.kind)}}</span></div>
                            <strong class="history-quantity">{{h.effective_quantity??h.quantity}} {{unitLabel(h.effective_quantity??h.quantity)}}</strong>
                        </header>
                        <p class="history-balance">On Hand {{h.on_hand}} · Reserved {{h.reserved}} · Expired {{h.expired_units}}</p>
                        <p v-if="h.request_ref" class="history-reference">Request {{h.request_ref}}</p>
                        <p class="history-actor">Recorded by {{h.actor_name||'Unknown user'}}</p>
                        <p v-if="surplusMovementReason(h.reason)" class="history-reason">{{ surplusMovementReason(h.reason) }}</p>
                        <p v-if="h.effective_quantity!==undefined && h.effective_quantity!==h.quantity" class="history-correction-note">Updated to {{ h.effective_quantity }} {{unitLabel(h.effective_quantity)}}. Original entry remains in history.</p>
                        <p v-if="h.corrects_movement_id && h.correction_target" class="history-correction-note">Corrects {{movementLabel(h.correction_target.kind).toLowerCase()}} from {{formatDisplayDate(h.correction_target.created_at)}} (original {{h.correction_target.quantity}} {{unitLabel(h.correction_target.quantity)}}).</p>
                        <p v-else-if="h.corrects_movement_id" class="history-correction-note">Corrects an earlier inventory entry; updated quantity {{h.corrected_quantity}} {{unitLabel(h.corrected_quantity)}}.</p>
                        <p v-if="h.corrected_formula_details" class="history-correction-note">Formula details corrected to {{[h.corrected_formula_details.formulaName,formulaFormLabel(h.corrected_formula_details.form),h.corrected_formula_details.flavor].filter(Boolean).join(' ')}}.</p>
                        <button v-if="h.correctable" class="text-button" type="button" @click="start('correct-entry',selected,h)">Correct entry</button>
                    </article>
                    <button
                        class="button"
                        @click="modal = ''"
                    >
                        Close
                    </button>
                </div>
                <div v-else-if="modal==='edit-inventory'" class="inventory-edit-actions">
                    <div v-if="selected" class="history-product">
                        <strong>{{[selected.formulaName,formulaFormLabel(selected.form),selected.flavor,selected.packaging].filter(Boolean).join(' ')}}</strong>
                        <span>{{agencyName(selected.agencyId)}} · {{selected.clinicName || 'Clinic not specified'}}</span>
                    </div>
                    <p>Select an inventory action for this lot.</p>
                    <button class="button" type="button" @click="selected && showHistory(selected)">Inventory History</button>
                    <button v-if="reviewer && !selected?.clinicId && !selected?.reserved" class="button" type="button" @click="start('assign-clinic',selected)">Assign Clinic</button>
                    <button v-if="reviewer && selected && availableUnits(selected)>0" class="button" type="button" @click="start('deduct',selected)">Deduct stock</button>
                    <button v-if="reviewer" class="button" type="button" @click="start('correct-expiry',selected)">Correct expiration</button>
                    <button v-if="!reviewer && selected && availableUnits(selected)>0 && daysRemaining(selected.expirationDate,localDate())>=45 && daysRemaining(selected.expirationDate,localDate())<=60" class="button" type="button" @click="start('donate',selected)">Record donation</button>
                    <button v-if="selected && lotDisposition(selected)==='destruction' && (selected.expiredUnits>0 || availableUnits(selected)>0)" class="button" type="button" @click="start('destroy',selected)">Record destruction</button>
                    <div class="dialog-actions"><button class="button" type="button" @click="modal=''">Close</button></div>
                </div>
                <form v-else-if="modal==='use-request'" @submit.prevent="openShipment">
                    <div v-if="selected" class="history-product">
                        <strong>{{[selected.formulaName,formulaFormLabel(selected.form),selected.flavor,selected.packaging].filter(Boolean).join(' ')}}</strong>
                        <span>{{agencyName(selected.agencyId)}} · {{selected.clinicName || 'Clinic not specified'}}</span>
                    </div>
                    <p>Select a matching request. You’ll choose the quantity and reserve stock in its Shipment section.</p>
                    <p v-if="requestsLoading" role="status">Loading matching requests…</p>
                    <p v-else-if="requestChoiceError" role="alert">{{requestChoiceError}}</p>
                    <template v-else>
                        <label>Find Request<input v-model="requestSearch" type="search" placeholder="Participant or receiving agency" /></label>
                        <label>Destination Request<select v-model="destinationRequest" required><option disabled value="">Select a Request</option><option v-for="r in searchableRequests" :key="r.id" :value="String(r.id)" :disabled="!surplusShipmentDraft(r,selected!,[])">#{{r.id}} · {{r.participantName}} · {{agencyName(r.agencyId)}}<template v-if="!surplusShipmentDraft(r,selected!,[])"> · formula not requested</template></option></select></label>
                        <p v-if="!matchingRequests.length">No matching requests. The request must include this formula and belong to a different agency.</p>
                    </template>
                    <div class="dialog-actions"><button class="button" type="button" @click="modal=''">Cancel</button><button class="button button-secondary" :disabled="requestsLoading || !matchingRequests.some(r=>String(r.id)===destinationRequest)" type="submit">Continue to Shipment</button></div>
                </form>
                <form v-else-if="modal==='correct-entry'" class="correction-form" @submit.prevent="submit">
                    <div v-if="selected" class="history-product">
                        <strong>{{[selected.formulaName,formulaFormLabel(selected.form),selected.flavor,selected.packaging].filter(Boolean).join(' ')}}</strong>
                        <span>{{agencyName(selected.agencyId)}} · {{selected.clinicName || 'Clinic not specified'}}</span>
                    </div>
                    <article v-if="correctionTarget" class="history-entry correction-original-entry">
                        <header class="history-entry-heading">
                            <div><strong>{{formatDisplayDate(correctionTarget.created_at)}}</strong><span>{{movementLabel(correctionTarget.kind)}}</span></div>
                            <strong class="history-quantity">{{correctionTarget.effective_quantity??correctionTarget.quantity}} {{unitLabel(correctionTarget.effective_quantity??correctionTarget.quantity)}}</strong>
                        </header>
                        <p class="history-balance">Original entry: {{correctionTarget.quantity}} {{unitLabel(correctionTarget.quantity)}}. The original record stays in history; this correction is added as a separate entry.</p>
                    </article>
                    <div class="correction-fields">
                        <label>Corrected Formula<select v-model="correctedVariantSelection" required @change="selectCorrectedVariant(correctedVariantSelection)"><option value="">Select a catalog formula</option><option v-for="variant in surplusVariants" :key="variantSelectionKey(variant)" :value="variantSelectionKey(variant)">{{variant.formulaName}} · {{formulaFormLabel(variant.form)}}{{variant.flavor?' · '+variant.flavor:''}}</option></select></label>
                        <label>Corrected expiration date<input v-model="input.correctedExpirationDate" type="date" :min="localDate()" required /></label>
                        <label>Corrected Units<input v-model.number="input.quantity" type="number" min="0" step="1" required /></label>
                        <label>Correction explanation<textarea v-model="input.reason" rows="2" required></textarea></label>
                        <label>Correcting staff name<input v-model="input.confirmerName" required /></label>
                        <label>Correction date<input v-model="input.date" type="date" :max="localDate()" required /></label>
                    </div>
                    <div class="dialog-actions">
                        <button class="button" type="button" :disabled="busy" @click="modal='history'">Cancel</button>
                        <button class="button button-main" :disabled="busy">{{busy?'Saving…':'Save correction'}}</button>
                    </div>
                </form>
                <form
                    v-else
                    @submit.prevent="submit"
                >
                    <template v-if="['new', 'forecast'].includes(modal)"
                        ><label v-if="reviewer"
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
                            >Formula Name<div class="surplus-formula-picker"><input v-model="formulaSearch" class="form-input" type="search" placeholder="Search any part of a formula name" autocomplete="off" @input="updateSurplusFormulaSearch"/><div v-if="!input.formulaName" class="surplus-formula-options" role="listbox" aria-label="Matching formula names"><button v-for="name in filteredSurplusFormulaNames" :key="name" type="button" role="option" @click="selectSurplusFormula(name)">{{name}}</button><small v-if="formulaSearch.trim() && !filteredSurplusFormulaNames.length">No matching formulas.</small></div><small v-if="input.formulaName">Selected: {{input.formulaName}}</small></div><small v-if="productError" role="alert">The product catalog could not be loaded. Close and try again.</small><small v-else-if="!surplusFormulaNames.length">No active formula products are available in the Products list.</small></label
                        ><label
                            >Form<select v-model="input.form" class="form-input" required :disabled="!surplusAvailableForms.length" @change="selectSurplusForm"><option value="">Select a form</option><option v-for="form in surplusAvailableForms" :key="form" :value="form">{{formulaFormLabel(form)}}</option></select></label
                        ><label>Flavor<select v-model="selectedSurplusFlavor" class="form-input" required :disabled="!input.form" @change="selectSurplusFlavor(selectedSurplusFlavor)"><option value="__unselected__">Select a flavor</option><option v-for="flavor in surplusAvailableFlavors" :key="flavor||'unflavored'" :value="flavor||'__unflavored__'">{{flavor||'Unflavored'}}</option></select></label
                        ><label v-if="surplusAvailablePackagings.length>1">Package size<select v-model="input.packaging" class="form-input" required><option value="">Select a package size</option><option v-for="packaging in surplusAvailablePackagings" :key="packaging" :value="packaging">{{packaging}}</option></select></label
                        ><label v-else-if="surplusAvailablePackagings.length===1">Package size<input class="form-input" :value="surplusAvailablePackagings[0]" disabled/></label
                    ></template>
                    <label v-if="['new','forecast','review','confirm','assign-clinic'].includes(modal)">{{modal==='confirm'?'Actual storage clinic':'Storage clinic'}}<select v-model="input.clinicId" :required="modal==='assign-clinic'" :disabled="clinicStatus==='pending'"><option value="">Clinic not specified</option><option v-for="c in formClinics?.clinics" :key="c.id" :value="c.id">{{c.clinicName}}</option></select></label>
                    <p v-if="clinicError &amp;&amp; ['new','forecast','review','confirm','assign-clinic'].includes(modal)" role="alert">Clinics could not be loaded. Close and try again.</p>
                    <label
                        v-if="
                            ['new', 'reconcile', 'deduct', 'donate', 'destroy', 'confirm', 'forecast'].includes(modal)
                        "
                        >{{ modal === 'forecast' ? 'Anticipated Units' : 'Units'
                        }}<input
                            v-model.number="input.quantity"
                            type="number"
                            :min="modal==='new'&&!reviewer ? 1 : ['new', 'reconcile', 'confirm', 'forecast'].includes(modal) ? 0 : 1"
                            step="1"
                            required
                    /></label>
                    <p v-if="selected && ['review', 'reconcile'].includes(modal)">
                        Current usable count {{ selected.onHand }}, reserved {{ selected.reserved }}, expired
                        {{ selected.expiredUnits }}. Inventory version {{ selected.version }}. Proposed change:
                        {{ proposedCountChange }} {{unitLabel(proposedCountChange)}}.
                    </p>
                    <p v-if="modal === 'review'">
                        Reported count: {{ report.reported_units }} {{unitLabel(report.reported_units)}}, expires {{ formatDisplayDate(report.expiration_date) }}. Confirm
                        this replaces the current balance for this formula, form, flavor and expiration.
                    </p>
                    <label v-if="['new', 'review', 'confirm', 'correct-expiry'].includes(modal)"
                        >Expiration date<input
                            v-model="input.expirationDate"
                            :readonly="modal === 'review' && !!report?.expiration_date"
                            type="date"
                            required /></label
                    >
                    <p v-if="recordedSurplusAction" role="status">{{ recordedSurplusAction }}</p>
                    <label v-if="modal === 'forecast'"
                        >Agency confirmation due<input
                            v-model="input.dueDate"
                            type="date"
                            required
                    /></label>
                    <label v-if="['new', 'review', 'reconcile', 'correct-expiry', 'confirm'].includes(modal)"
                        >{{ modal === 'confirm' ? 'Variance explanation (required if actual differs)' : 'Reason'
                        }}<textarea
                            v-model="input.reason"
                            :required="modal==='new'&&!reviewer ? false : modal !== 'confirm' || input.quantity !== forecast.expected_units"
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
                                v-if="selected && daysRemaining(selected.expirationDate, localDate()) >= 45 && daysRemaining(selected.expirationDate, localDate()) <= 60"
                                value="Donation"
                            >
                                Donation
                            </option>
                            <option value="Inventory correction">Inventory correction</option>
                        </select></label
                    >
                    <label v-if="modal === 'forecast' || (reviewer && ['deduct', 'destroy'].includes(modal))"
                        >Request / reference<input
                            v-model="input.requestRef"
                            :required="modal !== 'forecast'" /></label
                    >
                    <template v-if="['confirm', 'destroy', 'donate'].includes(modal)||(modal==='new'&&!reviewer)"
                        ><label
                            >{{ modal === 'donate' ? 'Staff name attesting to donation' : 'Staff name' }}<input
                                v-model="input.confirmerName"
                                required /></label
                        ><label
                            >{{ modal === 'destroy' ? 'Verified destruction date' : modal === 'donate' ? 'Donation date' : 'Physical count date'
                            }}<input
                                v-model="input.date"
                                type="date"
                                :max="localDate()"
                                required /></label></template
                    >
                    <p v-if="modal === 'donate'">Record formula donated while it is 45–60 days from expiration. Only unreserved Units can be donated.</p>
                    <p v-if="modal === 'destroy'">
                        Confirm these Units have been physically destroyed and the Formula Destruction Form completed.
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
.legacy-transfer {box-sizing:border-box;display:block;width:100%;max-width:var(--surplus-content-width);border:1px solid var(--line);border-radius:8px;padding:0 12px;margin:8px 0;font-size:13px;line-height:1.4;}
.legacy-transfer.transfer-cancelled {background:var(--surface-raised);border-color:var(--line);color:var(--muted);}
.legacy-transfer.transfer-cancelled .legacy-transfer-status {background:var(--surface-raised);color:var(--muted);}
.transfer-archive {max-width:var(--surplus-content-width);margin:20px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:8px;}
.transfer-archive > summary {font-size:14px;font-weight:650;cursor:pointer;}
.archived-transfer-row {max-width:none;margin:10px 0 0;}
.completed-transfer-status {background:var(--success-bg);border-color:var(--success-text);color:var(--success-text);}
.completed-transfer-row {background:var(--surface-raised);}
.archived-transfer-quantity {font-size:12px;font-weight:650;white-space:nowrap;}
.legacy-transfer-summary-row {display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding:12px 0;cursor:pointer;list-style:none;}
.legacy-transfer-summary-row::-webkit-details-marker {display:none;}
.legacy-transfer-summary-row > strong {font-size:14px;flex:1;}
.legacy-transfer-summary-row > span:nth-child(2) {color:var(--muted);font-size:12px;}
.legacy-transfer[open] > .legacy-transfer-summary-row {padding-bottom:8px;}
.transfer-direction {max-width:var(--surplus-content-width);padding:12px 0;border-top:1px solid var(--line);}
.transfer-direction-heading {display:flex;align-items:center;gap:10px;margin:8px 0;}
.transfer-direction-heading h3 {margin:0;font-size:1rem;}
.transfer-direction-heading > span {display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:12px;background:var(--surface-raised);font-size:12px;font-weight:650;}
.legacy-transfer-status {font-size:12px;line-height:1.4;font-weight:600;border:1px solid var(--line);border-radius:12px;padding:2px 8px;white-space:nowrap;}
.legacy-transfer-route {display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:4px;}
.legacy-transfer-route b {font-weight:600;}
.legacy-transfer-summary {display:grid;grid-template-columns:72px 144px 136px minmax(0,1fr);gap:4px 16px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}
.legacy-transfer-summary strong {color:var(--text);}
.legacy-transfer p {margin:12px 0 0;font-size:13px;line-height:1.4;}
.legacy-transfer summary {font-size:13px;line-height:1.4;color:var(--muted);cursor:pointer;width:fit-content;}
@media(max-width:800px){.legacy-transfer-summary{grid-template-columns:repeat(2,minmax(0,1fr));}}

.surplus-views {display:flex;gap:4px;flex-wrap:wrap;margin:16px 0 24px;border-bottom:1px solid var(--line);}
.surplus-views .surplus-tab {appearance:none;border:1px solid transparent;border-bottom:0;border-radius:7px 7px 0 0;background:transparent;color:var(--muted);font:inherit;font-size:14px;line-height:1.4;padding:9px 16px;min-height:40px;cursor:pointer;}
.surplus-views .surplus-tab:hover {background:var(--surface-raised);color:var(--text);}
.surplus-views .surplus-tab[aria-selected="true"] {background:var(--purple);border-color:var(--purple);color:#fff;font-weight:700;box-shadow:0 2px 0 var(--purple);}
.surplus-views .surplus-tab:focus-visible {outline:3px solid var(--focus-ring,#1976d2);outline-offset:2px;z-index:1;}
.surplus-filters .button {font-size:14px;line-height:1.4;padding:6px 12px;min-height:32px;}
.surplus-page h2 {font-size:20px;line-height:1.4;margin:0 0 12px;}
#transfers-panel {margin-top:0;}
#transfers-panel > p {font-size:13px;line-height:1.4;margin:0 0 16px;}
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
.counts-actions {display:flex;gap:10px;align-items:center;margin:0 0 20px;min-height:40px;}
.surplus-counts-section {margin-top:32px;padding-top:20px;border-top:1px solid var(--line);}
.surplus-counts-heading {display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px;}
.surplus-counts-heading h2 {margin:0;}
.surplus-counts-heading .counts-actions {margin:0;}
.inventory-section-heading {display:flex;align-items:center;justify-content:space-between;gap:16px;}
.inventory-section-heading h2 {margin:0;}
.surplus-filters {
    justify-content: start;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0 8px;
}
.surplus-filters label {margin:0;gap:4px;font-size:14px;}
.surplus-filters input {width:240px;}
.surplus-filters :is(input,select) {padding:6px 10px;font-size:14px;line-height:1.4;min-height:32px;box-sizing:border-box;}
#inventory-panel > p {font-size:14px;line-height:1.45;}
.inventory-table-wrap {max-width:var(--surplus-content-width);}
.inventory-archive {max-width:var(--surplus-content-width);margin-top:16px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;}
.inventory-archive > summary {font-size:14px;font-weight:650;cursor:pointer;}
.inventory-archive > p {font-size:13px;line-height:1.4;margin:10px 0;}
.inventory-archive-row {display:grid;grid-template-columns:minmax(220px,2fr) minmax(130px,1fr) minmax(80px,.5fr) auto;align-items:center;gap:14px;padding:10px 0;border-top:1px solid var(--line);font-size:14px;}
.inventory-archive-row > div:first-child {display:grid;gap:3px;}
.inventory-archive-row small,.inventory-archive-row > div > span {font-size:13px;color:var(--muted);}
.inventory-archive-actions {display:flex;gap:12px;white-space:nowrap;}
.inventory-disposition-row {
    grid-template-columns: minmax(0, 1fr) repeat(2, 5.75rem) repeat(2, 3.75rem) max-content;
    gap: 6px 12px;
    padding-block: 7px;
}
.inventory-disposition-row > div:not(:first-child):not(:last-child) {
    display: grid;
    gap: 3px;
    font-variant-numeric: tabular-nums;
}
.inventory-disposition-row strong {overflow-wrap:anywhere;}
.inventory-disposition-row .inventory-archive-actions {justify-self:end;}
@media (max-width: 850px) {
    .inventory-archive-row {grid-template-columns:repeat(2, minmax(0, 1fr));}
    .inventory-archive-row > div:first-child {grid-column:1 / -1;}
    .inventory-disposition-row .inventory-archive-actions {grid-column:1 / -1;}
}
.inventory-table-wrap {overflow-x:auto;}
.inventory-table {width:100%;max-width:50rem;min-width:45rem;table-layout:fixed;font-size:13px;}
.inventory-date-column {width:5rem;}
.inventory-count-column {width:4.35rem;}
.inventory-action-column {width:9.5rem;}
.inventory-table :is(th,td) {padding:6px 7px;vertical-align:middle;line-height:1.25;}
.inventory-table th {font-size:12px;white-space:normal;overflow-wrap:anywhere;}
.inventory-table :is(th,td):nth-child(2) {white-space:normal;}
.inventory-expiration-summary {display:block;font-size:11px;color:var(--muted);}
.inventory-table .inventory-group-row td {background:var(--surface-raised);font-weight:600;}
.inventory-table .inventory-lot-detail td:first-child {padding-left:28px;}
.inventory-table .inventory-lot-label {font-size:13px;color:var(--muted);}
.inventory-table :is(th,td):nth-child(n+4):nth-child(-n+7) {text-align:right;font-variant-numeric:tabular-nums;}
.inventory-table :is(th,td):nth-child(3) {white-space:nowrap;font-variant-numeric:tabular-nums;}
.inventory-table :is(th,td):nth-child(8) {text-align:right;}
.inventory-table .inventory-product {overflow-wrap:anywhere;}
.inventory-product strong {display:block;font-size:14px;line-height:1.4;}
.inventory-product span {display:inline;color:var(--muted);font-size:12px;line-height:1.3;}
.inventory-product span + span::before {content:" · ";}
.inventory-quarantine {display:block;color:var(--muted);font-size:12px;}
.inventory-available {font-weight:700;}
.inventory-table .inventory-expiration {font-size:14px;font-weight:700;white-space:nowrap;}
.inventory-table .inventory-quantity {font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}
.inventory-table .row-actions {min-width:0;}
.inventory-table .row-actions .button {max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;margin:0 5px 0 0;padding:4px 6px;font-size:12px;line-height:1.25;min-height:26px;}
.inventory-table .inventory-actions {display:inline-block;margin:0;position:relative;font-size:13px;line-height:1.4;}
.inventory-table .inventory-actions > div {min-width:150px;padding:10px 0 2px;white-space:normal;}
.inventory-edit-actions {display:grid;justify-items:start;gap:10px;}
.inventory-edit-actions > p {margin:0 0 4px;}
.inventory-edit-actions > .button {min-width:190px;text-align:left;}
.history-product {display:grid;gap:4px;padding:12px;margin:0 0 8px;background:var(--surface-raised);border-radius:8px;}
.history-product strong {font-size:16px;}
.history-product span,.history-actor,.history-reference {font-size:12px;color:var(--muted);}
.history-empty {padding:16px 0;color:var(--muted);}
.history-entry {border-bottom:1px solid var(--line);padding:14px 0;}
.history-entry-heading {display:flex;align-items:center;justify-content:space-between;gap:12px;}
.history-entry-heading > div {display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.history-entry-heading > div > strong {font-size:14px;}
.history-entry-heading > div > span {font-size:12px;color:var(--muted);}
.history-quantity {font-size:15px;white-space:nowrap;}
.history-entry :is(.history-balance,.history-reference,.history-actor,.history-reason,.history-correction-note) {margin:6px 0 0;font-size:12px;line-height:1.4;}
.history-balance {font-weight:600;font-variant-numeric:tabular-nums;}
.history-entry .history-actor,.history-entry .history-correction-note {color:var(--muted);}
.correction-original-entry {margin:8px 0 16px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-raised);}
.correction-fields {display:grid;gap:8px;}
.correction-fields label {margin:0;font-size:13px;font-weight:600;}
.surplus-formula-options {display:grid;max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:6px;background:var(--surface);}
.surplus-formula-options button {padding:9px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);text-align:left;cursor:pointer;}
.surplus-formula-options button:hover,.surplus-formula-options button:focus-visible {background:var(--surface-raised);}
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
