<script setup lang="ts">
import {shipmentFormulaOptions,shipmentFormulaKey,resolveShipmentFormula,shipmentFormulaLabel,requireShipmentFormula} from '~/../shared/shipmentFormulas';
import type {Directive} from 'vue';
import {blankClinicAddress,validateShipping} from '~/../shared/shipping';
const vTrackingSize:Directive<HTMLTextAreaElement>={mounted:fitTrackingNumbers,updated:fitTrackingNumbers};
function fitTrackingNumbers(input:HTMLTextAreaElement){input.style.height='auto';input.style.height=`${input.scrollHeight+input.offsetHeight-input.clientHeight}px`;}
import {formulaAuthorizations,formatIssuanceMonth,validateFormulaAuthorizations} from '~/../shared/formulaAuthorizations';
import {transferAuthorizationError,transferEntryQuantity,transferCatalogUnitsPerCase,matchingTransferLot} from '~/../shared/requestTransfers';
import type {SurplusLot} from '~/../shared/surplus';
import {canDeleteShipment,storedShipmentRows} from '~/../shared/shipmentDeletion';
import {shipmentFeatureFlags} from '~/../shared/featureFlags';
import {formatCaseEquivalent} from '~/../shared/shipmentQuantities';
import {caseBalance} from '~/../shared/shipmentCaseTracking';
import {breastfeedingOptions,validateBreastfeeding} from '~/../shared/breastfeeding';
import {participantAgeAlerts} from '~/../shared/participantAgeAlerts';
import {localDate} from '~/../shared/surplus';
import {validateRequestedMonths} from '~/../shared/requestMonthSelection';
import {editableRequestFormulas,requestFormulaUpdates} from '~/../shared/requestFormulaEditing';
import {blankFormula,formulaEntryName,validateFormulaEntry,validateFormulaSelection,type FormulaEntry} from '~/../shared/formulaEntries';
import {shipmentReceived,canConfirmShipment,shipmentReceiptKey,type ShipmentReceiptSelection} from '~/../shared/shipmentReceipts';
import {staffShipmentRows,shipmentHasUnsentChanges} from '~/../shared/shipmentPublishing';
import {blankShipment,requestShipments,validateShipments,type RequestShipment} from '~/../shared/requestShipments';
import {requestFormulas,participantNames,insuranceDetails,requestedMonthLabels,foodRestrictionLabel,formulaFormLabel,providerAddressLines,submissionDateOnly,participantAgeAtBenefitsStart} from '~/../shared/requestPresentation';
import { validateDiagnoses } from '~/../shared/diagnosisCatalog';
import {canEditSubmission} from '~/../shared/requestEditing';
import type { ProductRecord, RequestRecord, RequestStatus } from '~/../shared/domain';
import { getNextBenefitMonth, canGenerateAuthorizationForm, getApprovalStatus, canSelectShippedStatus } from '~/../shared/requestOperations';
import { normalizeRequestedMonths, validateRequestDetailNumbers, validateSurplusItems } from '~/../shared/requestDetailFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

type Agency = { name: string; shippingAddress: string; city: string; state: string; postalCode: string };
type Representative = { name: string; email: string; phone?: string };

function formatSubmittedDate(value?: string) {
    if (!value) {
        return '—';
    }
    value = submissionDateOnly(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
    return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

const props = defineProps<{
    request: RequestRecord | null;
    products?: ProductRecord[];
    agency?: Agency;
    rep?: Representative;
    hasPrevious?: boolean;
    hasNext?: boolean;
}>();
const emit = defineEmits<{ close: []; previous: []; next: [] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const draft = reactive<Partial<RequestRecord>>({});
const saving = ref(false);
const documentOpen=ref(false);
watch(()=>[props.request?.id,props.request?.prescriptionAttachment?.storageKey,identity.value],()=>{documentOpen.value=false;});
const error = ref('');
const staffSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const photoNames = ref<string[]>([]);
const surplusRemovalIndex = ref<number | null>(null);
const editingSection = ref<'participant' | 'overview' | 'prescription' | 'food' | 'shipping' | null>(null);
const editableDiagnoses = ref<string[]>([]);
const editableFormulas = ref<FormulaEntry[]>([]);
const prescriptionSection = ref<HTMLElement>();
const shippingSection = ref<HTMLElement>();
watch(() => [props.request?.id, identity.value], async () => {
    if (identity.value === 'agency' && props.request?.status === 'shipped') {
        await nextTick();
        shippingSection.value?.scrollIntoView({block:'start',behavior:'instant'});
        shippingSection.value?.focus({preventScroll:true});
    }
}, {immediate:true,flush:'post'});
const agencySaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const reportingSurplus = ref(false);
const previousDecision = ref<Partial<Pick<RequestRecord, 'status' | 'approved' | 'staffNotes'>> | null>(null);
const pendingDecision = ref<'denied' | null>(null);
const sendingEtaIndex = ref<number | null>(null);
const editingEtaIndex = ref<number | null>(null);
const deletingShipmentIndex=ref<number|null>(null);
const receiptEditors=ref<Record<number,boolean>>({});
const shipmentDeleteNotice=ref('');
const shipmentPublishNotice=ref<{index:number;updated:boolean}|null>(null);
const shippingSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const shipmentFeatures=shipmentFeatureFlags(useRuntimeConfig().public);
const shipmentCaseBalance=computed(()=>(shipmentFeatures.caseReconciliation||shipmentFeatures.potentialOverDelivery)?caseBalance(props.request ?? {}):null);
const canStaffEdit = computed(() => identity.value === 'admin' || identity.value === 'internal');
const reviewerOpenDate = ref(localDate());
watch(() => props.request?.id, () => { reviewerOpenDate.value = localDate();editingEtaIndex.value=null;shipmentPublishNotice.value=null; });
const ageMilestoneAlerts = computed(() => participantAgeAlerts(props.request?.participantDob,reviewerOpenDate.value,30));
const canEditOriginal= computed(()=>!!props.request&&canEditSubmission(props.request));
const {data:distributorData}=await useFetch<{distributors:import('~/../shared/distributors').DistributorProfile[]}>('/api/distributors',{headers:computed(()=>({'x-demo-user':identity.value})),watch:[identity]});
function selectDistributor(shipment:import('~/../shared/requestShipments').RequestShipment,id:string){shipment.distributorId=id||undefined;const found=distributorData.value?.distributors.find(d=>d.id===id);shipment.supplier=found?.name??'';}
const {data:transferAgencies}=await useFetch('/api/agencies');
const {data:transferStock,refresh:refreshTransferStock}=await useFetch<{lots:SurplusLot[]}>('/api/surplus',{headers:computed(()=>({'x-demo-user':identity.value})),server:false,watch:[identity]});
const shipmentFormulaChoices=computed(()=>props.request?shipmentFormulaOptions(props.request):[]);
function shipmentFormula(row:RequestShipment){return row.shipmentFormula??(props.request?resolveShipmentFormula(props.request,row):undefined);}
function shipmentRequest(row:RequestShipment):Partial<RequestRecord>{const formula=props.request?resolveShipmentFormula(props.request,row):undefined;return formula?{...props.request,requestedFormulas:[{...formula,productForm:formula.productForm!,ouncesPrescribed:0}]}:props.request??{};}
function shipmentCatalogSize(row:RequestShipment){const formula=shipmentFormula(row);return formula?transferCatalogUnitsPerCase({formulaName:formula.productName,form:formula.productForm??'',flavor:formula.flavor},props.products??[])??((props.request?.requestedFormulas?.length??1)<=1?selectedProduct.value?.unitsPerCase:undefined):undefined;}
function selectShipmentFormula(row:RequestShipment,key:string){const formula=shipmentFormulaChoices.value.find(f=>shipmentFormulaKey(f)===key);row.shipmentFormula=formula?{...formula}:undefined;row.sourceLotId=undefined;row.unitsPerCase=shipmentCatalogSize(row);syncTransferQuantity(row);}
function transferLots(row:RequestShipment){return (transferStock.value?.lots??[]).filter(lot=>props.request&&lot.agencyId===row.sourceAgencyId&&matchingTransferLot(shipmentRequest(row),lot)&&lot.expirationDate>=localDate()&&!lot.expiredUnits&&lot.onHand>lot.reserved);}
function changeShipmentSource(row:RequestShipment,value:string){row.shipmentSource=value==='agency'?'agency':'distributor';row.sourceAgencyId=undefined;row.sourceLotId=undefined;row.distributorId=undefined;row.supplier=undefined;row.unitsToTransfer=undefined;row.casesShipped=0;row.looseUnitsShipped=0;if(value==='agency')row.carrier='gso';}
function selectTransferLot(row:RequestShipment){const lot=transferLots(row).find(l=>l.id===row.sourceLotId);if(lot&&props.request)row.shipmentFormula=requireShipmentFormula(props.request,{transferFormulaName:lot.formulaName,transferForm:lot.form,transferFlavor:lot.flavor});row.unitsPerCase=lot?transferCatalogUnitsPerCase(lot,props.products??[]):undefined;syncTransferQuantity(row);}
function syncTransferQuantity(row:RequestShipment){if(row.shipmentSource==='agency')row.unitsToTransfer=transferEntryQuantity(row);}
function transferDraftFields(row:RequestShipment,size?:number){
 if(row.shipmentSource!=='agency'||row.transferId||!Number.isSafeInteger(size)||!size)return {};
 const total=row.unitsToTransfer??transferEntryQuantity({...row,unitsPerCase:size});
 return total===undefined?{}:{unitsToTransfer:total,casesShipped:Math.floor(total/size),looseUnitsShipped:total%size};
}
const transferAuthorizationIndex=ref<number|null>(null);
const transferAuthorizationMessage=ref('');
async function reserveShipmentTransfer(index:number){
    transferAuthorizationIndex.value=index;transferAuthorizationMessage.value='';
    const row=draft.shipments?.[index];if(!row||!props.request)return;
    syncTransferQuantity(row);
    const validation=transferStock.value?transferAuthorizationError(shipmentRequest(row),row,transferStock.value.lots):'Surplus inventory is not available yet. Please try again.';
    if(validation){transferAuthorizationMessage.value=validation;return;}
    await save({shipmentDrafts:draft.shipments,reserveTransferIndex:index});
    if(error.value){transferAuthorizationMessage.value=error.value;return;}
    transferAuthorizationIndex.value=null;await refreshTransferStock();
}
const canRepEdit = computed(() => identity.value === 'admin' || identity.value === 'agency');
const selectedProduct = computed(() => props.products?.find((product) => product.id === props.request?.productId));

function authorizationProduct(authorization:{productName:string;productForm?:string}) {return props.products?.find(product=>product.name===authorization.productName&&product.form===authorization.productForm);}

function copyRequest(request: RequestRecord): Partial<RequestRecord> {
    const requestedMonths = normalizeRequestedMonths(request.benefitMonthsRequested);
    return {
        ...request,
        genericFields:{...request.genericFields},
        shipping:request.shipping?{...request.shipping}:undefined,
        formulaAuthorizations:formulaAuthorizations(request,benefitMonths.value[0]?.value??''),
        shipments:staffShipmentRows(request).map(row=>{const size=row.unitsPerCase ?? ((request.requestedFormulas?.length ?? 1)<=1?selectedProduct.value?.unitsPerCase:undefined);return {...row,unitsPerCase:size,...transferDraftFields(row,size)};}),
        requestedFormulas: request.requestedFormulas?.map(formula=>({...formula})),
        participantFirstName: participantNames(request).first,
        participantLastName: participantNames(request).last,
        trackingNumbers: request.trackingNumbers?.map((tracking) => ({ ...tracking })),
        receivedPhotos: request.receivedPhotos ? [...request.receivedPhotos] : undefined,
        benefitIssuances:
            request.benefitIssuances?.map((issuance) => ({ ...issuance })) ??
            [{ month: benefitMonths.value[0]?.value ?? '', quantity: 0 }],
        benefitMonthsRequested: normalizeRequestedMonths(request.benefitMonthsRequested),
        surplusItems: request.surplusItems?.map((item) => ({ ...item })) ?? [],
    };
}

const benefitMonths = computed(() => {
    const start = props.request?.benefitsStartDate ?? new Date().toISOString().slice(0, 7) + '-01';
    const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return Array.from({ length: 24 }, (_, index) => {
        const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index, 1));
        const value = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
        return { value, label: formatIssuanceMonth(value) };
    });
});

function formatDisplayDate(value?: string) {
    if (!value) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[2]}-${match[3]}-${match[1]}` : value;
}

function formatTitleCase(value?: string) {
    if (!value) return '—';
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDoctorPhone(event: Event) {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneNumber(input.value);
    draft.doctorOfficePhone = formatted;
    input.value = formatted;
}

watch(
    () => props.request,
    (request) => {
        Object.keys(draft).forEach((key) => delete draft[key as keyof typeof draft]);
        if (request) {
            Object.assign(draft, copyRequest(request));
        }
        photoNames.value = request?.receivedPhotos ? [...request.receivedPhotos] : [];
        error.value = '';
        staffSaveStatus.value = 'idle';
        agencySaveStatus.value = 'idle';
        previousDecision.value = null;
        pendingDecision.value = null;
        deletingShipmentIndex.value=null;
        receiptEditors.value={};
        shipmentDeleteNotice.value='';
        shippingSaveStatus.value = 'idle';
        reportingSurplus.value = false;
    },
    { immediate: true },
);

async function save(updates: Partial<RequestRecord> & {reserveTransferIndex?:number;deleteShipmentIndex?:number;sendEtaShipmentIndex?:number;confirmShipmentReceipts?:ShipmentReceiptSelection[]} = draft) {
    if (!props.request) {
        return;
    }
    const savingRequest=props.request;
    saving.value = true;
    error.value = '';
    try {
        const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${savingRequest.id}`, {
            method: 'PUT',
            headers: {'x-demo-user':identity.value},
            body: {...updates,revision:savingRequest.revision ?? 0},
        });
        Object.assign(savingRequest, result.request);
        if (props.request?.id===savingRequest.id) Object.assign(draft, copyRequest(result.request));
    } catch (requestError) {
        error.value = (requestError as {data?:{statusMessage?:string};statusMessage?:string}).data?.statusMessage ?? (requestError as {statusMessage?:string}).statusMessage ?? 'Request could not be updated.';
    } finally {
        saving.value = false;
    }
}

async function denyRequest() {
    if (!String(draft.staffNotes ?? '').trim()) {
        error.value = 'Give a reason above staff notes before denying this request.';
        return;
    }
    draft.status = 'denied';
    await save({ status: 'denied', staffNotes: draft.staffNotes });
}

function addBenefitMonth(formulaIndex:number) {
    const authorization=draft.formulaAuthorizations![formulaIndex]!;
    const issuances = authorization.benefitIssuances;
    const month = getNextBenefitMonth(issuances) || benefitMonths.value[0]?.value || '';
    if (!month || issuances.some((issuance) => issuance.month === month)) {
        return;
    }
    authorization.benefitIssuances = [...issuances, { month, quantity: 0 }];
}

function removeBenefitMonth(formulaIndex:number,index: number) {
    draft.formulaAuthorizations?.[formulaIndex]?.benefitIssuances.splice(index, 1);
}

function addRequestedMonth() {
    const selected = normalizeRequestedMonths(draft.benefitMonthsRequested);
    if (selected.length >= 3) return;
    const month = benefitMonths.value.find((option) => !selected.includes(option.value))?.value;
    if (month) draft.benefitMonthsRequested = [...selected, month].sort();
}

function removeRequestedMonth(index: number) {
    draft.benefitMonthsRequested = (draft.benefitMonthsRequested ?? []).filter((_, itemIndex) => itemIndex !== index);
}

function startEditing(section: 'participant' | 'overview' | 'prescription' | 'food' | 'shipping') {
    if(section==='shipping'){draft.shipping={...blankClinicAddress(),...draft.shipping,clinicName:draft.shipping?.clinicName||props.agency?.name||'',attention:draft.shipping?.attention||props.rep?.name||'',email:draft.shipping?.email||props.rep?.email||'',phone:formatPhoneNumber(draft.shipping?.phone||props.rep?.phone||'')};}
    if (section === 'overview') {
        editableDiagnoses.value = (draft.diagnosis ?? '').split(/[\n;]/).map(value => value.trim()).filter(Boolean);
        editableFormulas.value = editableRequestFormulas(draft);
    }
    if (section === 'prescription') {
        draft.doctorOfficePhone = formatPhoneNumber(draft.doctorOfficePhone ?? '');
        draft.doctorOfficeAddress = providerAddressLines(draft.doctorOfficeAddress).filter(line => line !== '—').join('\n');
    }
    editingSection.value = section;
    error.value = '';
}

function cancelEditing() {
    if (props.request) Object.assign(draft, copyRequest(props.request));
    editingSection.value = null;
    error.value = '';
}

function saveFormSection() {
    const savedSection = editingSection.value;
    const savedRequestId = props.request?.id;
    const updates: Partial<RequestRecord> = {};
    if (editingSection.value === 'participant') {
        const breastfeedingError = validateBreastfeeding(draft);
        if (breastfeedingError) {error.value = breastfeedingError; return;}

        const monthError = validateRequestedMonths(draft.benefitMonthsRequested);
        if (monthError) {error.value = monthError; return;}

        Object.assign(updates, {
            participantFamilyId: draft.participantFamilyId,
            benefitMonthsRequested: normalizeRequestedMonths(draft.benefitMonthsRequested),
            mediCalStatus: draft.medicalStatus==='yes'?draft.mediCalStatus:undefined,
            participantDob: draft.participantDob,
            benefitsStartDate: draft.benefitsStartDate,
            wicIndividualId: draft.wicIndividualId,
            breastfeedingStatus: draft.breastfeedingStatus,
            breastfeedingDiscontinuedDate: draft.breastfeedingStatus === 'Discontinued BF' ? draft.breastfeedingDiscontinuedDate : '',
            medicalStatus: draft.medicalStatus,
        });
    } else if (editingSection.value === 'overview') {
        const diagnoses = editableDiagnoses.value.map(value => value.trim()).filter(Boolean).join('\n');
        const diagnosisError = validateDiagnoses(diagnoses);
        if (diagnosisError) { error.value = diagnosisError; return; }
        const duplicateError = validateFormulaSelection(editableFormulas.value.map(entry => ({name:formulaEntryName(entry),form:entry.productForm,flavor:entry.formulaFlavor})));
        const formulaError = editableFormulas.value.map(validateFormulaEntry).find(Boolean);
        if (duplicateError || formulaError || !editableFormulas.value.length) { error.value = duplicateError || formulaError || 'Add a formula.'; return; }
        if (!Number.isInteger(Number(draft.durationMonths)) || Number(draft.durationMonths) < 1 || Number(draft.durationMonths) > 6) {error.value = 'Enter Duration between 1 and 6 months.'; return;}
        Object.assign(updates, requestFormulaUpdates({...draft, diagnosis: diagnoses},editableFormulas.value));
        const first = editableFormulas.value[0]!;
        if (formulaEntryName(first) !== props.request?.productName || first.productForm !== props.request?.productForm)
            updates.productId = props.products?.find(product => product.name.toLowerCase() === formulaEntryName(first).toLowerCase() && product.form === first.productForm)?.id ?? -1;
    } else if (editingSection.value === 'food') {
        if (!draft.wicFoodRestrictions) { error.value = 'Select WIC Food Restrictions.'; return; }
        if (draft.wicFoodRestrictions === 'not-indicated' && (!draft.wicStaffFoodRestrictions || !draft.wicNutritionStaffName?.trim() || (draft.wicStaffFoodRestrictions === 'restricted' && !draft.wicNutritionStaffNotes?.trim()))) {
            error.value = 'Complete the WIC Nutrition Staff selection, name, and notes when food restrictions are selected.';
            return;
        }
        Object.assign(updates, {
            wicFoodRestrictions: draft.wicFoodRestrictions,
            wicFoodRestrictionDetails: draft.wicFoodRestrictions === 'restricted' ? draft.wicFoodRestrictionDetails : '',
            wicStaffFoodRestrictions: draft.wicFoodRestrictions === 'not-indicated' ? draft.wicStaffFoodRestrictions : undefined,
            wicNutritionStaffName: draft.wicFoodRestrictions === 'not-indicated' ? draft.wicNutritionStaffName : '',
            wicNutritionStaffNotes: draft.wicFoodRestrictions === 'not-indicated' && draft.wicStaffFoodRestrictions === 'restricted' ? draft.wicNutritionStaffNotes : '',
        });
    } else if(editingSection.value==='shipping'){
        const shipping={...draft.shipping!,clinicId:undefined,phone:normalizePhoneNumber(draft.shipping?.phone??'')};
        const shippingError=validateShipping(shipping);if(shippingError){error.value=shippingError;return;}
        updates.shipping=shipping;
    } else if (editingSection.value === 'prescription') {
        Object.assign(updates, {
            doctorPrintedName: draft.doctorPrintedName,
            doctorHasSignedOff: draft.doctorHasSignedOff,
            prescriptionSignedDate: draft.prescriptionSignedDate,
            doctorOfficeName: draft.doctorOfficeName,
            doctorOfficeAddress: draft.doctorOfficeAddress,
            doctorOfficePhone: normalizePhoneNumber(draft.doctorOfficePhone ?? ''),
        });
    }
    save(updates).then(async () => {
        if (error.value || props.request?.id !== savedRequestId) return;
        editingSection.value = null;
        await nextTick();
        if (savedSection === 'overview') {
            prescriptionSection.value?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});
            prescriptionSection.value?.scrollIntoView({block:'start',behavior:'instant'});
        }
    });
}

function addSurplusItem() {
    draft.surplusItems = [...(draft.surplusItems ?? []), { productName: '', units: 0, expirationDate: '' }];
}

function startSurplusReport() {
    reportingSurplus.value = true;
    if (!draft.surplusItems?.length) addSurplusItem();
}

function requestRemoveSurplusItem(index: number) {
    surplusRemovalIndex.value = index;
}

function confirmRemoveSurplusItem() {
    if (surplusRemovalIndex.value !== null) {
        draft.surplusItems?.splice(surplusRemovalIndex.value, 1);
    }
    surplusRemovalIndex.value = null;
}

async function saveStaffFields() {
    staffSaveStatus.value = 'saving';
    const authorizations=draft.formulaAuthorizations??[];
    const first=authorizations[0];
    const issuances = first?.benefitIssuances ?? [];
    const validationErrors = validateFormulaAuthorizations(authorizations);
    if (validationErrors.length) {
        error.value = validationErrors[0];
        staffSaveStatus.value = 'failed';
        return;
    }
    const detailNumberErrors = validateRequestDetailNumbers(draft);
    if (detailNumberErrors.length) {
        error.value = detailNumberErrors[0];
        staffSaveStatus.value = 'failed';
        return;
    }
    await save({
        formulaAuthorizations:authorizations,
        benefitIssuances: issuances,
        approvedCases: Number(first?.approvedCases??0),
        approvedMonths: Number(first?.approvedMonths??0),
        expectedSurplus: Number(first?.expectedSurplus??0),
        expectedSurplusUnit: first?.expectedSurplusUnit ?? 'units',
        agencyUnitsOnHand: Number(first?.agencyUnitsOnHand??0),
        agencyUnitsOnHandUnit: first?.agencyUnitsOnHandUnit ?? 'units',
        staffNotes: draft.staffNotes,
        nextSteps: draft.nextSteps,
    });
    staffSaveStatus.value = error.value ? 'failed' : 'saved';
}

function rememberPreviousDecision() {
    previousDecision.value = {
        status: draft.status,
        approved: draft.approved,
        staffNotes: draft.staffNotes,
    };
}

function changeStatus(event: Event) {
    const select = event.target as HTMLSelectElement;
    const status = select.value as RequestStatus;
    if (status === 'denied') {
        select.value = draft.status ?? '';
        setStaffDecision('denied');
        return;
    }

    draft.status = status;
    save({ status });
}

function setStaffDecision(status: 'approved' | 'denied') {
    if (status === 'denied') {
        pendingDecision.value = 'denied';
        return;
    }
    applyStaffDecision(status);
}

function applyStaffDecision(status: 'approved' | 'denied') {
    rememberPreviousDecision();
    save(
        status === 'approved'
            ? { approved: true, status: getApprovalStatus(draft.status ?? props.request!.status), nextSteps: draft.nextSteps, staffNotes: draft.staffNotes }
            : { approved: false, status: 'denied', nextSteps: draft.nextSteps, staffNotes: draft.staffNotes },
    );
}

function confirmDenial() {
    pendingDecision.value = null;
    applyStaffDecision('denied');
}

function undoStaffDecision() {
    const restoredDecision = previousDecision.value ?? {
        approved: false,
        status: draft.status === 'denied' ? 'opened' : draft.status,
    };
    previousDecision.value = null;
    save(restoredDecision);
}

async function confirmDeleteShipment(){
    const index=deletingShipmentIndex.value;
    if(index===null || !props.request || !canStaffEdit.value)return;
    const savedCount=props.request.shipmentDrafts?.length ?? storedShipmentRows(props.request).length;
    if(index>=savedCount){
        draft.shipments?.splice(index,1);
    }else{
        await save({deleteShipmentIndex:index});
        if(error.value)return;
    }
    deletingShipmentIndex.value=null;
    editingEtaIndex.value=null;
    shipmentPublishNotice.value=null;
    shippingSaveStatus.value='idle';
    shipmentDeleteNotice.value='Shipment deleted.';
}

function editingShipmentLogistics(row:RequestShipment,index:number){return editingShipmentPlan(row,index)||(canStaffEdit.value&&row.shipmentSource==='agency'&&row.transferStatus==='reserved'&&!!row.transferId&&(!row.transferEtaSentAt||editingEtaIndex.value===index));}
async function editOrSendTransferEta(index:number){
 const row=draft.shipments?.[index];if(!row?.transferId||!props.request)return;
 if(row.transferEtaSentAt&&editingEtaIndex.value!==index){editingEtaIndex.value=index;return;}
 const requestId=props.request.id;saving.value=true;error.value='';sendingEtaIndex.value=index;
 try{const result=await $fetch<{request:RequestRecord}>(`/api/request-transfers/${row.transferId}/eta`,{method:'POST',headers:{'x-demo-user':identity.value},body:{eta:row.eta,carrier:row.carrier,trackingNumbers:row.trackingNumbers,revision:props.request.revision??0}});if(props.request?.id===requestId){applyShipmentIssueResult(result.request);editingEtaIndex.value=null;}}
 catch(e){error.value=(e as {data?:{statusMessage?:string}}).data?.statusMessage??'Transfer ETA could not be saved.';}finally{saving.value=false;sendingEtaIndex.value=null;}
}
function editingShipmentPlan(shipment:RequestShipment,index:number){return canStaffEdit.value&&!shipment.transferId&&!shipmentReceived(props.request??{},shipment)&&shipment.receivedCases===undefined&&!shipment.issue&&!shipment.deletedIssues?.length&&(!shipment.etaSentAt||editingEtaIndex.value===index||shipmentHasUnsentChanges(shipment,requestShipments(props.request??{})[index]));}
function editOrSendEta(index:number){
    if(draft.shipments?.[index]?.etaSentAt && !editingShipmentPlan(draft.shipments[index]!,index)){if(editingEtaIndex.value!==null)cancelEtaEdit(editingEtaIndex.value);editingEtaIndex.value=index;return;}
    return saveShipments(index);
}
function cancelEtaEdit(index:number){
    const row=draft.shipments?.[index];const saved=requestShipments(props.request??{})[index];
    if(row&&saved&&draft.shipments)draft.shipments[index]=copyRequest(props.request!).shipments?.[index]??saved;
    editingEtaIndex.value=null;
}
function setShipmentTracking(shipment: RequestShipment, value: string) {
    shipment.trackingNumbers = value.split(/\r?\n/);
}
async function saveShipments(index?: number) {
    shippingSaveStatus.value = 'saving';
    sendingEtaIndex.value = index ?? null;
    const rows = draft.shipments ?? [];
    const validation = validateShipments(rows.map(row=>({...row,etaSentAt:undefined}))) || (index === undefined ? '' : validateShipments([rows[index]!],true));
    if (validation) {
        error.value = index === undefined ? validation : `Shipment ${index + 1}: ${validation.replace(/^Shipment 1: /,'')}`;
        shippingSaveStatus.value = 'failed';
        sendingEtaIndex.value = null;
        return;
    }
    const wasPublished=index!==undefined && !!requestShipments(props.request??{})[index]?.etaSentAt;
    await save({shipmentDrafts:rows, ...(index === undefined ? {} : {sendEtaShipmentIndex:index})});
    shippingSaveStatus.value = error.value ? 'failed' : index===undefined?'saved':'idle';
    if(!error.value && index!==undefined)shipmentPublishNotice.value={index,updated:wasPublished};
    if(!error.value && index!==undefined)editingEtaIndex.value=null;
    sendingEtaIndex.value = null;
}

function applyShipmentIssueResult(request:RequestRecord) {
    if (props.request?.id!==request.id) return;
    Object.assign(props.request,request);
    draft.shipments=canStaffEdit.value?staffShipmentRows(request):requestShipments(request);
    draft.receivedStatus=request.receivedStatus;
    draft.status=request.status;
}

async function saveAgencyUpdate() {
    agencySaveStatus.value = 'saving';
    const surplusErrors = validateSurplusItems(draft.surplusItems ?? []);
    if (draft.surplusItems?.length && surplusErrors.length) {
        error.value = surplusErrors[0];
        agencySaveStatus.value = 'failed';
        return;
    }
    await save({
        repNotes: draft.repNotes,
        surplusItems: draft.surplusItems ?? [],
    });
    agencySaveStatus.value = error.value ? 'failed' : 'saved';
}

</script>

<template>
    <section v-if="request?.prescriptionAttachment&&documentOpen" id="request-document-panel" class="request-document-pane" aria-label="Uploaded medical documentation" @click.stop>
        <div class="document-pane-header"><strong>{{request.prescriptionAttachment.fileName}}</strong><button type="button" class="button button-ghost" @click="documentOpen=false">Close document</button></div>
        <RequestDocumentPreview :key="`${request.id}-${request.prescriptionAttachment.storageKey}-${identity}`" :request-id="request.id" :attachment="request.prescriptionAttachment" />
    </section>
    <aside
        v-if="request"
        class="detail-drawer"
        :class="{'document-visible':documentOpen}"
        @click.stop
    >
        <div class="drawer-header">
            <div>
                <span class="eyebrow">Request #{{ request.id }}</span>
                <h2>{{ request.participantName }}</h2>
            </div>
            <div class="drawer-header-tools">
            <button v-if="request.prescriptionAttachment" type="button" class="button button-secondary attachment-toggle" :title="request.prescriptionAttachment.fileName" :aria-expanded="documentOpen" aria-controls="request-document-panel" @click="documentOpen=!documentOpen">{{request.prescriptionAttachment.fileName}}</button>
            <div class="drawer-header-actions">
                <button
                    class="button button-ghost"
                    type="button"
                    aria-label="Previous request"
                    :disabled="!hasPrevious || saving"
                    @click="emit('previous')"
                >
                    ‹ Prev
                </button>
                <button
                    class="button button-ghost"
                    type="button"
                    aria-label="Next request"
                    :disabled="!hasNext || saving"
                    @click="emit('next')"
                >
                    Next ›
                </button>
                <button
                    class="icon-button"
                    type="button"
                    aria-label="Close details"
                    @click="emit('close')"
                >
                    ×
                </button>
            </div>
            </div>
        </div>
        <div v-if="identity === 'agency' && canEditOriginal && request" class="form-actions"><NuxtLink class="button button-secondary" :to="{path:'/requests/new',query:{request:request.id}}">Edit submission</NuxtLink><small>Editable until Admin/FPU opens the submission.</small></div>
        <div class="drawer-status">
            <div class="request-status-tags">
                <span class="request-tag request-kind-tag">{{ request.requestKind === 'extension' ? 'Extension' : 'New' }}</span>
                <StatusBadge :status="draft.status ?? request.status" />
                <span
                    v-if="request.specialOrder"
                    class="request-tag"
                >Special order</span>
                <span
                    v-if="request.approved"
                    class="request-tag"
                >Approved</span>
            </div>
            <span>Submitted {{ formatSubmittedDate(request.submissionDate) }}</span>
        </div>
        <section class="detail-section participant-summary">
            <div class="section-heading">
                <h3>Participant</h3>
                <button v-if="canStaffEdit && editingSection !== 'participant'" class="text-button" type="button" @click="startEditing('participant')">Edit</button>
            </div>
            <div v-if="canStaffEdit && ageMilestoneAlerts.length" class="participant-age-alert" role="alert">
                <strong>Upcoming age milestone</strong>
                <p v-for="alert in ageMilestoneAlerts" :key="alert.milestone">Participant turns {{alert.milestone}} {{alert.daysUntil === 0 ? 'today' : `in ${alert.daysUntil} ${alert.daysUntil === 1 ? 'day' : 'days'}`}} ({{alert.date.slice(5,7)}}/{{alert.date.slice(8,10)}}/{{alert.date.slice(0,4)}}).</p>
            </div>
            <div v-if="editingSection === 'participant'" class="form-grid compact-form-grid">
                <label class="field-label">WIC Family ID<input v-model.number="draft.participantFamilyId" class="form-input" /></label>
                <label class="field-label">WIC Individual ID<input v-model="draft.wicIndividualId" class="form-input" /></label>
                <label class="field-label">Date of Birth<input v-model="draft.participantDob" class="form-input" type="date" /></label>
                <label class="field-label">Benefits Start Date<input v-model="draft.benefitsStartDate" class="form-input" type="date" /></label>
                <div class="field-label calculated-age-field"><span>Age at Benefits Start Date</span><strong>{{ participantAgeAtBenefitsStart(draft.participantDob, draft.benefitsStartDate) }}</strong></div>
                <label class="field-label">Health Insurance<select v-model="draft.medicalStatus" class="form-input"><option disabled value="">Select Health Insurance</option><option v-if="draft.medicalStatus==='pending'" value="pending">Pending</option><option value="yes">Medi-Cal</option><option value="no">Private Insurance</option></select></label>
                <label v-if="draft.medicalStatus==='yes'" class="field-label participant-insurance-status">Medi-Cal Status<select v-model="draft.mediCalStatus" class="form-input"><option>Denied</option><option>Pending PA</option><option>Product Not Covered</option></select></label>
                <label class="field-label">Breastfeeding<select v-model="draft.breastfeedingStatus" class="form-input" @change="draft.breastfeedingDiscontinuedDate = ''"><option value="">Select</option><option v-for="option in breastfeedingOptions" :key="option" :value="option">{{option}}</option></select></label>
                <label v-if="draft.breastfeedingStatus === 'Discontinued BF'" class="field-label">Date BF Discontinued<input v-model="draft.breastfeedingDiscontinuedDate" class="form-input" type="date" required /></label>
            </div>
            <div v-else class="detail-grid">
                <div><span>WIC Family ID</span><strong>{{ request.participantFamilyId ?? '—' }}</strong></div>
                <div><span>WIC Individual ID</span><strong>{{ request.wicIndividualId ?? '—' }}</strong></div>
                <div><span>Date of Birth</span><strong>{{ formatDisplayDate(request.participantDob) }}</strong></div>
                <div><span>Benefits Start Date</span><strong>{{ formatDisplayDate(request.benefitsStartDate) }}</strong></div>
                <div><span>Age at Benefits Start Date</span><strong>{{ participantAgeAtBenefitsStart(request.participantDob, request.benefitsStartDate) }}</strong></div>
                <div><span>Health Insurance</span><strong>{{ insuranceDetails(request) }}</strong></div>
                <div><span>Breastfeeding</span><strong>{{request.breastfeedingStatus || '—'}}</strong></div>
                <div v-if="request.breastfeedingStatus === 'Discontinued BF'"><span>Date BF Discontinued</span><strong>{{formatDisplayDate(request.breastfeedingDiscontinuedDate)}}</strong></div>
            </div>
            <div class="detail-grid requested-months-field">
                <div>
                    <span>Benefit Month(s) Requested</span>
                    <strong v-if="editingSection !== 'participant'">{{ requestedMonthLabels(request.benefitMonthsRequested) }}</strong>
                    <div v-else class="month-list">
                        <div v-for="(month, index) in draft.benefitMonthsRequested" :key="`${month}-${index}`" class="month-row">
                            <select v-model="draft.benefitMonthsRequested[index]" class="form-input">
                                <option v-for="option in benefitMonths" :key="option.value" :value="option.value" :disabled="option.value !== month && draft.benefitMonthsRequested?.includes(option.value)">{{ requestedMonthLabels([option.value]) }}</option>
                            </select>
                            <button class="icon-button" type="button" :aria-label="`Remove ${requestedMonthLabels([month])}`" @click="removeRequestedMonth(index)">×</button>
                        </div>
                        <button v-if="(draft.benefitMonthsRequested?.length ?? 0) < 3" class="text-button" type="button" @click="addRequestedMonth">+ Add requested month</button>
                    </div>
                </div>
            </div>
            <div v-if="editingSection === 'participant'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save Section</button>
            </div>
        </section>
        <p
            v-if="error"
            class="form-error"
        >
            {{ error }}
        </p>
        <section ref="prescriptionSection" class="detail-section prescription-detail-section">
            <div class="section-heading">
                <h3 tabindex="-1">Prescription</h3>
                <button v-if="canStaffEdit && editingSection !== 'overview'" class="text-button" type="button" @click="startEditing('overview')">Edit</button>
            </div>
            <div v-if="editingSection === 'overview'" class="form-grid compact-form-grid prescription-editor">
                <fieldset v-for="(formula,index) in editableFormulas" :key="index" class="detail-field-wide submitted-formula-card formula-edit-card">
                    <legend v-if="editableFormulas.length > 1">Formula {{index + 1}}</legend>
                    <AdditionalFormulaFields v-model="editableFormulas[index]" :index="index + 1" auto-fit-justification hide-required-markers />
                    <button v-if="index > 0" class="text-button" type="button" @click="editableFormulas.splice(index,1)">Remove Formula {{index + 1}}</button>
                </fieldset>
                <div v-if="editableFormulas.length < 2" class="detail-field-wide add-formula-action"><button class="button button-ghost add-formula-button" type="button" @click="editableFormulas.push(blankFormula())">Add another formula</button></div>
                <label class="field-label duration-field">Duration (in months)<input required v-model.number="draft.durationMonths" class="form-input" type="number" min="1" max="6" /></label>
                <fieldset class="detail-field-wide diagnosis-editor">
                    <legend>Qualifying Diagnosis(es)</legend>
                    <div v-for="(_, index) in editableDiagnoses" :key="index" class="diagnosis-edit-row">
                        <RequestDiagnosisEditor v-model="editableDiagnoses[index]" :index="index" />
                        <button type="button" class="text-button" :aria-label="`Remove diagnosis ${index + 1}`" @click="editableDiagnoses.splice(index, 1)">Remove</button>
                    </div>
                    <button type="button" class="text-button" @click="editableDiagnoses.push('')">Add Diagnosis</button>
                </fieldset>
            </div>
            <div v-else class="submitted-formula-details">
                <fieldset v-for="(formula,index) in requestFormulas(request)" :key="index" class="submitted-formula-card">
                    <legend v-if="requestFormulas(request).length>1">Formula {{index+1}}</legend>
                    <div class="detail-grid">
                        <div><span>Formula Name</span><strong>{{formula.otherFormulaName || formula.productName || '—'}}</strong></div>
                        <div><span>Form</span><strong>{{formulaFormLabel(formula.productForm)}}</strong></div>
                        <div v-if="formula.flavor"><span>Flavor</span><strong>{{formula.flavor}}</strong></div>
                        <div><span>Amount (in ounces/day)</span><strong>{{formula.ouncesPrescribed ?? '—'}}</strong></div>
                        <div v-if="formula.readyToFeedJustification"><span>Justification</span><strong>{{formula.readyToFeedJustification}}</strong></div>
                    </div>
                </fieldset>
                <div class="detail-grid"><div><span>Duration (in months)</span><strong>{{request.durationMonths ?? '—'}}</strong></div></div>
                <div><span class="detail-field-heading">Qualifying Diagnosis(es)</span><ul v-if="request.diagnosis?.trim()" class="diagnosis-list diagnosis-readonly"><li v-for="(diagnosis,index) in request.diagnosis.split(/[\n;]/).map(value=>value.trim()).filter(Boolean)" :key="index">{{diagnosis}}</li></ul><strong v-else>—</strong></div>
            </div>
            <div v-if="editingSection === 'overview'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save Section</button>
            </div>
        </section>
        <section class="detail-section">
            <div class="section-heading">
                <h3>WIC Food Restrictions</h3>
                <button v-if="canStaffEdit && editingSection !== 'food'" class="text-button" type="button" @click="startEditing('food')">Edit</button>
            </div>
            <div v-if="editingSection === 'food'" class="form-grid compact-form-grid food-restrictions-editor">
                <label class="field-label detail-field-wide">Health Care Provider Selection
                    <select v-model="draft.wicFoodRestrictions" class="form-input">
                        <option value="under-6-months">Participant is under 6 months</option>
                        <option value="none">No food restrictions (all WIC foods allowed)</option>
                        <option value="restricted">Food restrictions (see medical documentation)</option>
                        <option value="not-indicated">Neither box checked by HCP</option>
                    </select>
                </label>
                <template v-if="draft.wicFoodRestrictions === 'not-indicated'">
                    <label class="field-label detail-field-wide">WIC Nutrition Staff Selection
                        <select v-model="draft.wicStaffFoodRestrictions" class="form-input"><option value="" disabled>Select</option><option value="none">No food restrictions (all WIC foods allowed)</option><option value="restricted">Food restrictions (listed below)</option></select>
                    </label>
                    <label v-if="draft.wicStaffFoodRestrictions === 'restricted'" class="field-label detail-field-wide">WIC Nutrition Staff Notes<textarea v-model="draft.wicNutritionStaffNotes" class="form-textarea" /></label>
                    <label class="field-label detail-field-wide">WIC Nutrition Staff Name<input v-model="draft.wicNutritionStaffName" class="form-input" /></label>
                </template>
            </div>
            <div v-else class="detail-grid">
                <div class="detail-field-wide"><span>Health Care Provider Selection</span><strong>{{foodRestrictionLabel(request.wicFoodRestrictions)}}</strong></div>
                <div v-if="request.wicFoodRestrictionDetails"><span>Food Restriction Details</span><strong>{{request.wicFoodRestrictionDetails}}</strong></div>
                <template v-if="request.wicFoodRestrictions==='not-indicated'">
                    <div class="detail-field-wide"><span>WIC Nutrition Staff Selection</span><strong>{{request.wicStaffFoodRestrictions==='none'?'No food restrictions (all WIC foods allowed)':request.wicStaffFoodRestrictions==='restricted'?'Food restrictions (listed below)':'—'}}</strong></div>
                    <div v-if="request.wicStaffFoodRestrictions==='restricted'" class="detail-field-wide"><span>WIC Nutrition Staff Notes</span><strong class="preserve-lines">{{request.wicNutritionStaffNotes || '—'}}</strong></div>
                    <div><span>WIC Nutrition Staff Name</span><strong>{{request.wicNutritionStaffName || '—'}}</strong></div>
                </template>
            </div>
            <div v-if="editingSection === 'food'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save Section</button>
            </div>
        </section>
        <section class="detail-section">
            <div class="section-heading">
                <h3>Health Care Provider</h3>
                <button v-if="canStaffEdit && editingSection !== 'prescription'" class="text-button" type="button" @click="startEditing('prescription')">Edit</button>
            </div>
            <div v-if="editingSection === 'prescription'" class="form-grid compact-form-grid provider-editor">
                <label class="field-label">Provider Name<input v-model="draft.doctorPrintedName" class="form-input" /></label>
                <label class="field-label checkbox-control provider-signature-control">Provider Signature<input v-model="draft.doctorHasSignedOff" type="checkbox" /></label>
                <label class="field-label provider-date-signed">Date Signed<input v-model="draft.prescriptionSignedDate" class="form-input" type="date" /></label>
                <fieldset class="provider-clinic clinic-editor">
                    <legend>Medical Office/Clinic</legend>
                    <label class="field-label">Name<input v-model="draft.doctorOfficeName" class="form-input" /></label>
                    <label class="field-label">Address<textarea v-model="draft.doctorOfficeAddress" class="form-textarea provider-address-input" rows="2" @blur="draft.doctorOfficeAddress = providerAddressLines(draft.doctorOfficeAddress).filter(line => line !== '—').join('\n')" /></label>
                    <label class="field-label">Phone Number<input v-model="draft.doctorOfficePhone" class="form-input" type="tel" placeholder="(XXX) XXX-XXXX" @input="formatDoctorPhone" /></label>
                </fieldset>
            </div>
            <div v-else class="detail-grid">
                <div><span>Provider Name</span><strong>{{ request.doctorPrintedName ?? '—' }}</strong></div>
                <div><span>Provider Signature</span><strong>{{request.doctorHasSignedOff?'Verified on medical documentation':'Not verified'}}</strong></div>
                <div class="provider-date-signed"><span>Date Signed</span><strong>{{ formatDisplayDate(request.prescriptionSignedDate) }}</strong></div>
                <div class="provider-clinic"><span>Medical Office/Clinic</span><strong>{{ request.doctorOfficeName || '—' }}<template v-for="(line,index) in providerAddressLines(request.doctorOfficeAddress)" :key="index"><br />{{line}}</template><br />{{ request.doctorOfficePhone ? formatPhoneNumber(request.doctorOfficePhone) : '—' }}</strong></div>
            </div>
            <div v-if="editingSection === 'prescription'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save Section</button>
            </div>
        </section>
        <hr class="cdph-section-divider" />
        <section class="cdph-workspace" aria-label="State-Issued Formula Authorization">
            <header class="cdph-workspace-header"><h3>State-Issued Formula Authorization</h3></header>
        <section
            v-if="canStaffEdit"
            class="detail-section cdph-review-section"
        >
            <div class="panel-heading">
                <button
                    class="button button-secondary"
                    type="button"
                    :disabled="saving"
                    @click="save({ specialOrder: !draft.specialOrder })"
                >
                    {{ draft.specialOrder ? 'Remove special order' : 'Special order' }}
                </button>
            </div>
            <label class="field-label">
                Status
                <select
                    :value="draft.status"
                    class="form-input"
                    :disabled="saving"
                    @change="changeStatus"
                >
                    <option value="opened">Opened</option>
                    <option value="in_progress">In progress</option>
                    <option value="needs_info">Need info</option>
                    <option value="denied">Denied</option>
                    <option
                        v-if="canSelectShippedStatus(request ?? {})"
                        value="shipped"
                    >Shipped</option>
                </select>
            </label>
            <div class="decision-actions">
                <span class="decision-label">Decision</span>
                <div v-if="draft.approved === true" class="decision-selected decision-selected-approved">
                    <span>Approved</span>
                    <button class="icon-button" type="button" aria-label="Undo approval or denial" :disabled="saving" @click="undoStaffDecision">×</button>
                </div>
                <div v-else-if="draft.status === 'denied'" class="decision-selected decision-selected-denied">
                    <span>Denied</span>
                    <button class="icon-button" type="button" aria-label="Undo approval or denial" :disabled="saving" @click="undoStaffDecision">×</button>
                </div>
                <div v-else class="decision-buttons">
                    <button class="button button-secondary" type="button" :disabled="saving" @click="setStaffDecision('approved')">Approve</button>
                    <button class="button button-danger" type="button" :disabled="saving" @click="setStaffDecision('denied')">Deny</button>
                </div>
            </div>
            <fieldset class="cdph-fields" :disabled="draft.status === 'denied'">
            <div class="issuance-heading"><h3>Issuance</h3></div>
            <fieldset v-for="(authorization,formulaIndex) in draft.formulaAuthorizations" :key="`${authorization.productName}-${authorization.productForm}-${authorization.flavor}`" class="authorization-formula">
                <legend v-if="(draft.formulaAuthorizations?.length??0)>1">Formula {{formulaIndex+1}}</legend>
            <div class="detail-grid cdph-product-details">
                <div><span>Formula Name</span><strong>{{authorization.productName}}<template v-if="authorization.flavor"> · {{authorization.flavor}}</template><br />{{formulaFormLabel(authorization.productForm)}}</strong></div>
                <div><span>Product Number</span><strong>{{authorizationProduct(authorization)?.productCode ?? '—'}}</strong></div>
                <div><span>Units Per Case</span><strong>{{authorizationProduct(authorization)?.unitsPerCase ?? '—'}}</strong></div>
                <div><span>Yield</span><strong>{{authorizationProduct(authorization)?.yield !== undefined ? `${authorizationProduct(authorization)!.yield} fl oz` : '—'}}</strong></div>
            </div>
            <div class="form-grid compact-form-grid">
                <label class="field-label approval-quantity-field">
                    Approved Cases for Approved Months
                    <div class="case-month-input">
                        <input v-model.number="authorization.approvedCases" class="form-input authorization-number" type="number" inputmode="numeric" min="0" :aria-label="`Formula ${formulaIndex+1} Approved Cases`" />
                        <span>cases for</span>
                        <input v-model.number="authorization.approvedMonths" class="form-input authorization-number" type="number" inputmode="numeric" min="0" :aria-label="`Formula ${formulaIndex+1} Approved Months`" />
                        <span>months</span>
                    </div>
                </label>
                <label class="field-label">
                    Agency Unit(s) On Hand
                    <div class="surplus-input">
                        <input v-model.number="authorization.agencyUnitsOnHand" class="form-input authorization-number" type="number" inputmode="numeric" min="0" />
                        <select v-model="authorization.agencyUnitsOnHandUnit" class="form-input" aria-label="Agency Unit(s) On Hand Unit">
                            <option value="units">Unit(s)</option>
                            <option value="cases">Cases</option>
                        </select>
                    </div>
                </label>
                <label class="field-label">
                    Expected Surplus
                    <div class="surplus-input">
                        <input v-model.number="authorization.expectedSurplus" class="form-input authorization-number" type="number" inputmode="numeric" min="0" />
                        <select v-model="authorization.expectedSurplusUnit" class="form-input" aria-label="Expected Surplus Unit">
                            <option value="units">Unit(s)</option>
                            <option value="cases">Cases</option>
                        </select>
                    </div>
                </label>
            </div>
            <div class="benefit-allocation-editor">
                <div class="issuance-row-heading">
                    <h4>Select Month and Quantity</h4>
                    <button class="text-button" type="button" @click="addBenefitMonth(formulaIndex)">+ Add issuance month</button>
                </div>
                <div v-for="(issuance, index) in authorization.benefitIssuances" :key="`${issuance.month}-${index}`" class="month-row">
                    <select v-model="issuance.month" class="form-input month-select" :aria-label="`Formula ${formulaIndex+1} issuance month ${index+1}`">
                        <option value="">Select month</option>
                        <option v-for="month in benefitMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
                    </select>
                    <div class="quantity-input">
                        <input v-model.number="issuance.quantity" class="form-input month-quantity" type="number" inputmode="numeric" min="1" placeholder="Quantity" :aria-label="`Formula ${formulaIndex+1} issuance quantity ${index+1}`" />
                        <span>Unit(s)</span>
                    </div>
                    <button class="icon-button" type="button" aria-label="Remove benefit month" @click="removeBenefitMonth(formulaIndex,index)">×</button>
                </div>
            </div>
            </fieldset>
            <label class="field-label">
                Next Steps
                <textarea v-model="draft.nextSteps" class="form-textarea" placeholder="Add instructions or follow-up notes." />
            </label>
            <div class="staff-save-action">
                <button
                    class="button button-secondary"
                    type="button"
                    :disabled="saving"
                    @click="saveStaffFields"
                >
                    {{ staffSaveStatus === 'saving' ? 'SAVING…' : 'SAVE' }}
                </button>
                <span
                    v-if="staffSaveStatus !== 'idle'"
                    class="save-feedback"
                    :class="`save-feedback-${staffSaveStatus}`"
                    role="status"
                >
                    {{ staffSaveStatus === 'saving' ? 'Saving…' : staffSaveStatus === 'saved' ? 'Saved' : 'Save failed' }}
                </span>
            </div>
            <label
                v-if="draft.status === 'denied'"
                class="field-label"
            >
                Give reason
                <textarea
                    v-model="draft.staffNotes"
                    class="form-textarea"
                    placeholder="Explain the decision or next step."
                />
            </label>
            <a
                v-if="canGenerateAuthorizationForm(request)"
                class="button button-secondary"
                :href="`/api/requests/${request.id}/authorization-form.pdf`"
                target="_blank"
                rel="noreferrer"
            >
                Download Authorization Form
            </a>
            </fieldset>
        </section>

        <section ref="shippingSection" class="detail-section" tabindex="-1">
            <div class="section-heading"><h3>Shipping</h3><button v-if="canStaffEdit && editingSection!=='shipping'" class="text-button" type="button" @click="startEditing('shipping')">Edit</button></div>
            <form v-if="editingSection==='shipping' && draft.shipping" class="shipping-detail-editor" @submit.prevent="saveFormSection">
                <div class="form-grid compact-form-grid">
                    <label class="field-label detail-field-wide">Local Agency<input :value="agency?.name" class="form-input" disabled /></label>
                    <label class="field-label">Contact<input v-model="draft.shipping.attention" class="form-input" maxlength="250" /></label>
                    <label class="field-label">Phone Number<input v-model="draft.shipping.phone" class="form-input" type="tel" @blur="draft.shipping.phone=formatPhoneNumber(draft.shipping.phone??'')" /></label>
                    <label class="field-label detail-field-wide">Email<input v-model="draft.shipping.email" class="form-input" type="email" /></label>
                    <label class="field-label detail-field-wide">Street Address<input v-model="draft.shipping.addressLine1" class="form-input" required maxlength="250" /></label>
                    <label class="field-label detail-field-wide">Address Line 2<input v-model="draft.shipping.addressLine2" class="form-input" maxlength="250" /></label>
                    <label class="field-label">City<input v-model="draft.shipping.city" class="form-input" required maxlength="250" /></label>
                    <div class="form-grid shipping-state-zip"><label class="field-label">State<input v-model="draft.shipping.state" class="form-input" required maxlength="2" /></label><label class="field-label">ZIP Code<input v-model="draft.shipping.postalCode" class="form-input" required maxlength="10" /></label></div>
                </div>
                <p v-if="error" class="form-error" role="alert">{{error}}</p>
                <div class="form-actions"><button class="button button-ghost" type="button" :disabled="saving" @click="cancelEditing">Cancel</button><button class="button button-secondary" type="submit" :disabled="saving">Save Section</button></div>
            </form>
            <div v-if="canStaffEdit && shipmentCaseBalance" class="shipment-case-summary">
                <strong v-if="shipmentFeatures.caseReconciliation">Case Reconciliation</strong>
                <p v-if="shipmentFeatures.caseReconciliation">Original Approved: {{shipmentCaseBalance.approved ?? 'Not set'}} · Received: {{formatCaseEquivalent(shipmentCaseBalance.received)}} · Returned/Destroyed: {{formatCaseEquivalent(shipmentCaseBalance.disposed)}} · Damaged Held: {{formatCaseEquivalent(shipmentCaseBalance.damaged)}} · Usable Cases Kept (equivalent): {{formatCaseEquivalent(shipmentCaseBalance.retained)}}</p>
                <p v-if="shipmentFeatures.caseReconciliation && shipmentCaseBalance.excess>0" class="shipment-case-warning" role="alert"><strong>Approved case limit exceeded:</strong> {{formatCaseEquivalent(shipmentCaseBalance.retained)}} usable cases kept vs {{shipmentCaseBalance.approved}} originally approved ({{formatCaseEquivalent(shipmentCaseBalance.excess)}} excess). Review all original and replacement deliveries.</p>
                <p v-if="shipmentFeatures.potentialOverDelivery && shipmentCaseBalance.projectedExcess>0" class="shipment-case-warning" role="alert"><strong>Potential over-delivery:</strong> outstanding original and replacement shipments could exceed the approved limit by {{formatCaseEquivalent(shipmentCaseBalance.projectedExcess)}} cases. Review before sending more product.</p>
                <p v-if="shipmentFeatures.caseReconciliation && shipmentCaseBalance.needsApproval" class="shipment-case-warning" role="alert">Set the approved case limit so received quantities can be checked.</p>
            </div>
            <template v-if="editingSection!=='shipping'">
            <div class="detail-grid shipping-contact-details">
                <div><span>Contact</span><strong>{{request.shipping?.attention || rep?.name || '—'}}</strong></div>
                <div><span>Phone Number</span><strong>{{(request.shipping?.phone || rep?.phone)?formatPhoneNumber(request.shipping?.phone || rep?.phone || ''):'—'}}</strong></div>
                <div class="detail-field-wide"><span>Email</span><strong>{{request.shipping?.email || rep?.email || '—'}}</strong></div>
            </div>
            <div class="shipping-address-field"><span class="detail-field-heading">Shipping Address</span><address v-if="request.shipping" class="shipping-preview shipping-destination"><strong>{{agency?.name || '—'}}</strong><template v-if="request.shipping.attention || rep?.name"><br />Attn: {{request.shipping.attention || rep?.name}}</template><br />{{request.shipping.addressLine1}}<template v-if="request.shipping.addressLine2"><br />{{request.shipping.addressLine2}}</template><br />{{request.shipping.city}}, {{request.shipping.state}} {{request.shipping.postalCode}}</address><p v-else class="shipping-destination muted-copy">No shipping address saved for this request.</p></div>
            </template>
            <div class="shipment-list">
                <fieldset v-for="(shipment,index) in canStaffEdit ? draft.shipments : requestShipments(request)" :key="index" class="shipment-card">
                    <legend>{{ (canStaffEdit ? draft.shipments?.length : requestShipments(request).length)! > 1 ? `Shipment ${index + 1}` : 'Shipment' }}</legend>
                    <div class="detail-grid">
                        <label v-if="editingShipmentPlan(shipment,index) && !shipment.etaSentAt" class="field-label detail-field-wide">Formula<select :value="shipmentFormulaKey(shipmentFormula(shipment))" class="form-input" :aria-label="`Shipment ${index+1} Formula`" :disabled="saving || shipmentFormulaChoices.length===1" @change="selectShipmentFormula(shipment,($event.target as HTMLSelectElement).value)"><option value="">Select Formula</option><option v-for="formula in shipmentFormulaChoices" :key="shipmentFormulaKey(formula)" :value="shipmentFormulaKey(formula)">{{shipmentFormulaLabel(formula)}}</option></select></label>
                        <div v-else class="detail-field-wide"><span>Formula</span><strong>{{shipmentFormulaLabel(shipmentFormula(shipment))}}</strong></div>
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label detail-field-wide">Shipment Source<select :value="shipment.shipmentSource??'distributor'" class="form-input" :aria-label="`Shipment ${index+1} Source`" :disabled="saving || !!requestShipments(request)[index]?.etaSentAt" @change="changeShipmentSource(shipment,($event.target as HTMLSelectElement).value)"><option value="distributor">Distributor</option><option value="agency">Local Agency Transfer</option></select></label>
                        <template v-if="shipment.shipmentSource==='agency'">
                            <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Sending Local Agency<select :value="shipment.sourceAgencyId??''" class="form-input" :aria-label="`Shipment ${index+1} Sending Local Agency`" :disabled="saving" @change="shipment.sourceAgencyId=Number(($event.target as HTMLSelectElement).value);shipment.sourceLotId=undefined"><option value="">Select Local Agency</option><option v-for="item in transferAgencies?.agencies.filter(a=>a.id!==request.agencyId)" :key="item.id" :value="item.id">{{item.name}}</option></select></label>
                            <div v-else><span>From</span><strong>{{shipment.sourceAgencyName}}</strong></div>
                            <div><span>To</span><strong>{{agency?.name}}</strong></div>
                            <label v-if="editingShipmentPlan(shipment,index)" class="field-label detail-field-wide">Available Surplus<select v-model="shipment.sourceLotId" class="form-input" @change="selectTransferLot(shipment)" :aria-label="`Shipment ${index+1} Available Surplus`" :disabled="saving || !shipment.sourceAgencyId"><option :value="undefined">Select matching surplus</option><option v-for="lot in transferLots(shipment)" :key="lot.id" :value="lot.id">{{lot.formulaName}} · {{lot.form}}<template v-if="lot.flavor"> · {{lot.flavor}}</template> · {{lot.onHand-lot.reserved}} units · Expires {{formatDisplayDate(lot.expirationDate)}}</option></select><small v-if="shipment.sourceAgencyId && !transferLots(shipment).length">No matching, available surplus at this agency.</small></label>
                            <div v-else class="detail-field-wide"><span>Transferred Formula</span><strong>{{shipment.transferFormulaName}} · {{formulaFormLabel(shipment.transferForm)}}<template v-if="shipment.transferFlavor"> · {{shipment.transferFlavor}}</template> · Expires {{formatDisplayDate(shipment.transferExpiration)}}</strong></div>
                        </template>
                        <template v-else>
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Distributor<select :value="shipment.distributorId ?? ''" class="form-input" :aria-label="`Shipment ${index+1} Distributor`" :disabled="saving" @change="selectDistributor(shipment,($event.target as HTMLSelectElement).value)"><option value="">{{!shipment.distributorId && shipment.supplier?`${shipment.supplier} (legacy supplier)`:'Select Distributor'}}</option><option v-for="item in distributorData?.distributors" :key="item.id" :value="item.id">{{item.name}}</option></select></label>
                        <div v-else><span>Distributor</span><strong>{{shipment.supplier || '—'}}</strong></div>
                        </template>
                        <template v-if="shipmentFeatures.quantityTracking || shipmentFeatures.receiptQuantities || shipment.shipmentSource==='agency'">
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Unit(s) per Case<input v-model.number="shipment.unitsPerCase" class="form-input" type="number" min="1" step="1" @input="syncTransferQuantity(shipment)" :aria-label="`Shipment ${index+1} Unit(s) per Case`" :disabled="saving || shipment.receivedUnits!==undefined || shipment.dispositions?.some(item=>item.units!==undefined) || (!!requestShipments(request)[index]?.unitsPerCase && (shipment.receivedCases!==undefined || !!shipment.receivedAt || !!shipment.receiptConfirmed))" /></label>
                        <div v-else><span>Units per Case</span><strong>{{shipment.unitsPerCase ?? 'Not confirmed'}}</strong></div>
                        </template>
                        <label v-if="editingShipmentLogistics(shipment,index)" class="field-label">ETA<input v-model="shipment.eta" class="form-input" type="date" :aria-label="`Shipment ${index+1} ETA`" :disabled="saving" /></label>
                        <div v-else><span>ETA</span><strong>{{formatDisplayDate(shipment.eta)}}</strong></div>
                        <template v-if="shipment.shipmentSource==='agency'">
                            <template v-if="editingShipmentPlan(shipment,index)">
                                <label class="field-label">Cases to Transfer<input v-model.number="shipment.casesShipped" class="form-input" type="number" inputmode="numeric" min="0" step="1" :aria-label="`Shipment ${index+1} Cases to Transfer`" :disabled="saving" @input="syncTransferQuantity(shipment)" /></label>
                                <label class="field-label">Unit(s) to Transfer<input v-model.number="shipment.looseUnitsShipped" class="form-input" type="number" inputmode="numeric" min="0" :max="(shipment.unitsPerCase??1)-1" step="1" :aria-label="`Shipment ${index+1} Unit(s) to Transfer`" :disabled="saving" @input="syncTransferQuantity(shipment)" /></label>
                            </template>
                            <template v-else><div><span>Cases to Transfer</span><strong>{{shipment.casesShipped}}</strong></div><div><span>Units to Transfer</span><strong>{{shipment.looseUnitsShipped??0}}</strong></div></template>
                            <div class="detail-field-wide"><span>Total Transfer Quantity</span><strong>{{shipment.transferQuantity??shipment.unitsToTransfer??0}} units</strong></div>
                        </template>
                        <template v-else-if="shipmentFeatures.casesShipped">
                        <label v-if="editingShipmentPlan(shipment,index)" class="field-label">Cases Shipped<input v-model.number="shipment.casesShipped" class="form-input" type="number" min="0" :aria-label="`Shipment ${index+1} Cases Shipped`" :disabled="saving" /></label>
                        <div v-else><span>Cases Shipped</span><strong>{{shipment.casesShipped}}<template v-if="shipmentFeatures.quantityTracking && shipment.looseUnitsShipped"> + {{shipment.looseUnitsShipped}} loose units</template></strong></div>
                        <label v-if="shipmentFeatures.quantityTracking && editingShipmentPlan(shipment,index) && shipment.replacementFor!==undefined" class="field-label">Loose Unit(s) Shipped<input v-model.number="shipment.looseUnitsShipped" class="form-input" type="number" min="0" :max="(shipment.unitsPerCase??1)-1" :disabled="saving || shipment.replacementBasis==='cases'" :aria-label="`Shipment ${index+1} Loose Unit(s) Shipped`" /></label>
                        </template>
                        <label v-if="shipment.shipmentSource==='agency'" class="field-label detail-field-wide">Carrier<input value="GSO" class="form-input" readonly :aria-label="`Shipment ${index+1} Carrier`" /></label>
                        <label v-else-if="editingShipmentLogistics(shipment,index)" class="field-label detail-field-wide">Carrier<select v-model="shipment.carrier" class="form-input" :aria-label="`Shipment ${index+1} Carrier`" :disabled="saving"><option value="fedex">FedEx</option><option value="dhl">DHL</option><option value="ups">UPS</option></select></label>
                        <div v-else><span>Carrier</span><strong>{{shipment.carrier==='agency'?'Agency Delivery':shipment.carrier.toUpperCase()}}</strong></div>
                        <label v-if="editingShipmentLogistics(shipment,index)" class="field-label detail-field-wide">Tracking Numbers<textarea v-tracking-size :value="shipment.trackingNumbers.join('\n')" class="form-textarea shipment-tracking-input" placeholder="Enter one tracking number per line." :aria-label="`Shipment ${index+1} Tracking Numbers`" :disabled="saving" @input="setShipmentTracking(shipment,($event.target as HTMLTextAreaElement).value)" /></label>
                        <div v-else class="detail-field-wide"><span>{{shipment.shipmentSource==='agency'?'Tracking / Delivery Reference':'Tracking Numbers'}}</span><strong>{{shipment.trackingNumbers.join(', ') || 'N/A'}}</strong></div>
                    </div>
                    <ShipmentReceiptPanel :key="`receipt-${request.id}-${index}`" v-if="requestShipments(request)[index]" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-confirm="canRepEdit" @editing="value=>receiptEditors[index]=value" :catalog-units-per-case="shipmentCatalogSize(requestShipments(request)[index]!)" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <ShipmentCasePanel :key="`cases-${request.id}-${index}`" v-if="shipmentFeatures.quantityTracking && requestShipments(request)[index] && (!canStaffEdit || shipmentReceiptKey(shipment)===shipmentReceiptKey(requestShipments(request)[index]!))" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-manage="canStaffEdit" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <ShipmentIssuePanel :key="`${request.id}-${index}`" v-if="requestShipments(request)[index] && (!canStaffEdit || shipmentReceiptKey(shipment)===shipmentReceiptKey(requestShipments(request)[index]!))" :request="request" :shipment="requestShipments(request)[index]!" :index="index" :can-report="canRepEdit" :receipt-editing="!!receiptEditors[index]" :catalog-units-per-case="shipmentCatalogSize(requestShipments(request)[index]!)" :disabled="saving" @updated="applyShipmentIssueResult" />
                    <div v-if="shipment.shipmentSource==='agency'" class="shipping-save-action">
                        <button v-if="canStaffEdit && !shipment.transferId" class="button button-secondary" type="button" :disabled="saving" @click="reserveShipmentTransfer(index)">{{saving && transferAuthorizationIndex===index?'Authorizing…':'Authorize'}}</button>
                        <template v-if="canStaffEdit && shipment.transferId && shipment.transferStatus==='reserved'">
                            <button class="button button-secondary" type="button" :disabled="saving" @click="editOrSendTransferEta(index)">{{sendingEtaIndex===index?'Sending…':shipment.transferEtaSentAt?(editingShipmentLogistics(shipment,index)?'Send Update':'Edit ETA'):'Send ETA'}}</button>
                            <button v-if="shipment.transferEtaSentAt && editingShipmentLogistics(shipment,index)" class="button button-ghost" type="button" :disabled="saving" @click="cancelEtaEdit(index)">Cancel</button>
                            <span v-if="shipment.transferEtaSentAt && !editingShipmentLogistics(shipment,index)" class="shipment-sent-status" role="status">✓ ETA Sent</span>
                        </template>
                        <button v-if="canStaffEdit && canDeleteShipment({...request,shipmentDrafts:draft.shipments},index)" type="button" class="text-button" :disabled="saving" :aria-label="`Delete Shipment ${index+1}`" @click="deletingShipmentIndex=index">Delete Shipment</button>
                        <span v-if="shipment.transferId && shipment.transferStatus==='reserved'" class="shipment-sent-status" role="status"><span aria-hidden="true">✓</span> Transfer Requested</span><span v-else-if="shipment.transferId" :class="shipment.transferStatus==='received'?'shipment-sent-status':'shipment-transit-status'" role="status"><span v-if="shipment.transferStatus!=='received'" aria-hidden="true">→</span> {{shipment.transferStatus==='received'?'Transfer received':'In Transit'}}</span>
                        <NuxtLink v-if="shipment.transferId" to="/surplus" class="text-button">View Transfer</NuxtLink>
                        <p v-if="transferAuthorizationIndex===index && transferAuthorizationMessage" class="form-error transfer-authorization-error" role="alert">{{transferAuthorizationMessage}}</p>
                    </div>
                    <div v-else-if="canStaffEdit && !shipmentReceived(request,shipment) && shipment.receivedCases===undefined && !shipment.issue && !shipment.deletedIssues?.length" class="shipping-save-action">
                        <button class="button button-secondary" type="button" :disabled="saving" :aria-label="`${shipment.etaSentAt?(editingShipmentPlan(shipment,index)?'Send Update':'Edit ETA'):'Send ETA'} for shipment ${index+1}`" @click="editOrSendEta(index)">{{ sendingEtaIndex === index ? 'Sending…' : shipment.etaSentAt ? (editingShipmentPlan(shipment,index)?'Send Update':'Edit ETA') : 'Send ETA' }}</button>
                        <button v-if="shipment.etaSentAt && editingShipmentPlan(shipment,index)" class="button button-ghost" type="button" :disabled="saving" :aria-label="`Cancel ETA edit for shipment ${index+1}`" @click="cancelEtaEdit(index)">Cancel</button>
                        <button v-if="canStaffEdit && canDeleteShipment({...request,shipmentDrafts:draft.shipments},index)" type="button" class="text-button" :disabled="saving" :aria-label="`Delete Shipment ${index+1}`" @click="deletingShipmentIndex=index">Delete Shipment</button>
                        <span v-if="!shipment.etaSentAt" class="save-feedback" role="status">Draft · Not sent</span><span v-else-if="!shipmentHasUnsentChanges(shipment,requestShipments(request)[index])" class="shipment-sent-status" role="status"><span aria-hidden="true">✓</span> {{shipmentPublishNotice?.index===index && shipmentPublishNotice.updated ? 'Update Sent' : 'ETA Sent'}}</span>
                    </div>
                </fieldset>
            </div>
            <template v-if="canStaffEdit">
                <p v-if="shipmentDeleteNotice" class="save-feedback save-feedback-saved" role="status">{{shipmentDeleteNotice}}</p>
                <button class="text-button" type="button" @click="draft.shipments = [...(draft.shipments ?? []), {...blankShipment(),unitsPerCase:(request.requestedFormulas?.length ?? 1)<=1?selectedProduct?.unitsPerCase:undefined}]">+ Add another shipment</button>
                <div class="shipping-save-action">
                    <button class="button button-ghost" type="button" :disabled="saving || !draft.shipments?.length" @click="saveShipments()">Save Shipments</button>
                    <span v-if="shippingSaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${shippingSaveStatus}`" role="status">{{ shippingSaveStatus === 'saving' ? 'Saving…' : shippingSaveStatus === 'saved' ? 'Draft saved · Not sent to Local Agency' : 'Save failed' }}</span>
                </div>
            </template>
            <p
                v-if="photoNames.length"
                class="muted-copy"
            >
                {{ photoNames.join(', ') }}
            </p>
            <div v-if="canStaffEdit && canRepEdit && reportingSurplus" class="benefit-allocation-editor">
                <div class="panel-heading">
                    <div>
                        <h4>Surplus</h4>
                        <span>Use one row per formula and expiration date.</span>
                    </div>
                </div>
                <div v-for="(item, index) in draft.surplusItems" :key="index" class="surplus-entry-row">
                    <label class="field-label">Formula<input v-model="item.productName" class="form-input" /></label>
                    <label class="field-label">Unit(s)<input v-model.number="item.units" class="form-input" type="number" min="0" /></label>
                    <label class="field-label">Expiration<input v-model="item.expirationDate" class="form-input" type="date" /></label>
                    <button class="icon-button" type="button" aria-label="Remove surplus row" @click="requestRemoveSurplusItem(index)">×</button>
                </div>
                <div class="surplus-add-row-action">
                    <button class="text-button" type="button" @click="addSurplusItem">+ Add row</button>
                </div>
            </div>
            <div v-else-if="canStaffEdit && canRepEdit" class="confirmation-response-actions">
                <button class="button button-primary report-surplus-button" type="button" @click="startSurplusReport">Report Surplus</button>
            </div>
            <div v-if="canStaffEdit && canRepEdit && reportingSurplus" class="agency-save-action">
                <button
                v-if="canRepEdit"
                class="button button-secondary"
                type="button"
                :disabled="saving"
                @click="saveAgencyUpdate"
                >
                    {{ agencySaveStatus === 'saving' ? 'SAVING…' : 'SAVE' }}
                </button>
                <span v-if="agencySaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${agencySaveStatus}`" role="status">
                    {{ agencySaveStatus === 'saving' ? 'Saving…' : agencySaveStatus === 'saved' ? 'Saved' : 'Save failed' }}
                </span>
            </div>
        </section>
        </section>
        <hr class="cdph-section-divider" />


        <div v-if="canStaffEdit && deletingShipmentIndex!==null" class="confirmation-backdrop" @click.self="!saving && (deletingShipmentIndex=null)" @keydown.esc="!saving && (deletingShipmentIndex=null)">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-shipment-title">
                <h3 id="delete-shipment-title">Are you sure you want to delete this shipment?</h3>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" :disabled="saving" @click="deletingShipmentIndex=null">Cancel</button>
                    <button class="button button-danger" type="button" :disabled="saving" @click="confirmDeleteShipment">{{saving?'Deleting…':'Delete Shipment'}}</button>
                </div>
                <p v-if="error" class="form-error" role="alert">{{error}}</p>
            </div>
        </div>

        <div v-if="pendingDecision" class="confirmation-backdrop" @click.self="pendingDecision = null">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="deny-decision-title">
                <h3 id="deny-decision-title">Are you sure you want to deny this request?</h3>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" @click="pendingDecision = null">Cancel</button>
                    <button class="button button-danger" type="button" @click="confirmDenial">Confirm Denial</button>
                </div>
            </div>
        </div>

        <RequestSurplusPanel v-if="request" :request="request" :key="request.id" />
        <div v-if="surplusRemovalIndex !== null" class="confirmation-backdrop" @click.self="surplusRemovalIndex = null">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="remove-surplus-title">
                <h3 id="remove-surplus-title">Remove surplus row?</h3>
                <p>This surplus row will be removed from the form.</p>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" @click="surplusRemovalIndex = null">Cancel</button>
                    <button class="button button-danger" type="button" @click="confirmRemoveSurplusItem">Remove</button>
                </div>
            </div>
        </div>

    </aside>
</template>
