<script setup lang="ts">
import {participantAgeAlerts} from '~/../shared/participantAgeAlerts';
import {localDate} from '~/../shared/surplus';
import {validateRequestedMonths} from '~/../shared/requestMonthSelection';
import {editableRequestFormulas,requestFormulaUpdates} from '~/../shared/requestFormulaEditing';
import {blankFormula,formulaEntryName,validateFormulaEntry,validateFormulaSelection,type FormulaEntry} from '~/../shared/formulaEntries';
import {blankShipment,requestShipments,shipmentUpdates,validateShipments,type RequestShipment} from '~/../shared/requestShipments';
import {requestFormulas,participantNames,insuranceDetails,requestedMonthLabels,foodRestrictionLabel,formulaFormLabel,providerAddressLines,submissionDateOnly,participantAgeAtBenefitsStart} from '~/../shared/requestPresentation';
import { validateDiagnoses } from '~/../shared/diagnosisCatalog';
import {canEditSubmission} from '~/../shared/requestEditing';
import type { ProductRecord, RequestRecord, RequestStatus } from '~/../shared/domain';
import { getNextBenefitMonth, validateBenefitIssuances, canGenerateAuthorizationForm, getApprovalStatus, canSelectShippedStatus } from '~/../shared/requestOperations';
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
const editingSection = ref<'participant' | 'overview' | 'prescription' | 'food' | null>(null);
const editableDiagnoses = ref<string[]>([]);
const editableFormulas = ref<FormulaEntry[]>([]);
const prescriptionSection = ref<HTMLElement>();
const agencyAlertSaving = ref(false);
const agencyAlertMessage = ref('');
const agencySaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const reportingProblem = ref(false);
const changingConfirmation = ref(false);
const reportingSurplus = ref(false);
const originalConfirmation = ref<{ receivedStatus?: RequestRecord['receivedStatus']; status?: RequestRecord['status'] } | null>(null);
const previousDecision = ref<Partial<Pick<RequestRecord, 'status' | 'approved' | 'staffNotes'>> | null>(null);
const pendingDecision = ref<'denied' | null>(null);
const sendingEtaIndex = ref<number | null>(null);
const shippingSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const canStaffEdit = computed(() => identity.value === 'admin' || identity.value === 'internal');
const reviewerOpenDate = ref(localDate());
watch(() => props.request?.id, () => { reviewerOpenDate.value = localDate(); });
const ageMilestoneAlerts = computed(() => participantAgeAlerts(props.request?.participantDob,reviewerOpenDate.value,30));
const canEditOriginal= computed(()=>!!props.request&&canEditSubmission(props.request));
const canRepEdit = computed(() => identity.value === 'admin' || identity.value === 'agency');
const selectedProduct = computed(() => props.products?.find((product) => product.id === props.request?.productId));
const receiptStatusLabel = computed(() => {
    if (draft.receivedStatus === 'received') return 'Confirmed receipt';
    if (draft.receivedStatus === 'damaged') return 'Shipment issue reported';
    if (draft.receivedStatus === 'missing') return 'Shipment issue reported';
    if (draft.receivedStatus === 'incomplete') return 'Incomplete delivery reported';
    return 'Awaiting confirmation';
});

function copyRequest(request: RequestRecord): Partial<RequestRecord> {
    const requestedMonths = normalizeRequestedMonths(request.benefitMonthsRequested);
    return {
        ...request,
        genericFields:{...request.genericFields},
        shipments:requestShipments(request),
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
        return { value, label: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
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
        agencyAlertMessage.value = '';
        agencySaveStatus.value = 'idle';
        reportingProblem.value = false;
        changingConfirmation.value = false;
        originalConfirmation.value = null;
        previousDecision.value = null;
        pendingDecision.value = null;
        shippingSaveStatus.value = 'idle';
        reportingSurplus.value = false;
    },
    { immediate: true },
);

async function save(updates: Partial<RequestRecord> & {sendEtaShipmentIndex?:number} = draft) {
    if (!props.request) {
        return;
    }
    saving.value = true;
    error.value = '';
    try {
        const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${props.request.id}`, {
            method: 'PUT',
            headers: {'x-demo-user':identity.value},
            body: updates,
        });
        Object.assign(props.request, result.request);
        Object.assign(draft, result.request);
    } catch (requestError) {
        error.value = (requestError as { statusMessage?: string }).statusMessage ?? 'Request could not be updated.';
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

function addBenefitMonth() {
    const issuances = draft.benefitIssuances ?? [];
    const month = getNextBenefitMonth(issuances) || benefitMonths.value[0]?.value || '';
    if (!month || issuances.some((issuance) => issuance.month === month)) {
        return;
    }
    draft.benefitIssuances = [...issuances, { month, quantity: 0 }];
}

function removeBenefitMonth(index: number) {
    draft.benefitIssuances?.splice(index, 1);
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

function startEditing(section: 'participant' | 'overview' | 'prescription' | 'food') {
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
        const monthError = validateRequestedMonths(draft.benefitMonthsRequested);
        if (monthError) {error.value = monthError; return;}

        Object.assign(updates, {
            participantFamilyId: draft.participantFamilyId,
            benefitMonthsRequested: normalizeRequestedMonths(draft.benefitMonthsRequested),
            mediCalStatus: draft.medicalStatus==='yes'?draft.mediCalStatus:undefined,
            participantDob: draft.participantDob,
            benefitsStartDate: draft.benefitsStartDate,
            wicIndividualId: draft.wicIndividualId,
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
    const issuances = draft.benefitIssuances ?? [];
    const validationErrors = validateBenefitIssuances(issuances);
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
        benefitIssuances: issuances,
        approvedCases: Number(draft.approvedCases),
        approvedMonths: Number(draft.approvedMonths),
        expectedSurplus: Number(draft.expectedSurplus),
        expectedSurplusUnit: draft.expectedSurplusUnit ?? 'units',
        agencyUnitsOnHand: Number(draft.agencyUnitsOnHand),
        agencyUnitsOnHandUnit: draft.agencyUnitsOnHandUnit ?? 'units',
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

function setShipmentTracking(shipment: RequestShipment, value: string) {
    shipment.trackingNumbers = value.split(/\r?\n/);
}
async function saveShipments(index?: number) {
    shippingSaveStatus.value = 'saving';
    sendingEtaIndex.value = index ?? null;
    const rows = draft.shipments ?? [];
    const validation = validateShipments(rows) || (index === undefined ? '' : validateShipments([rows[index]!],true));
    if (validation) {
        error.value = index === undefined ? validation : `Shipment ${index + 1}: ${validation.replace(/^Shipment 1: /,'')}`;
        shippingSaveStatus.value = 'failed';
        sendingEtaIndex.value = null;
        return;
    }
    await save({...shipmentUpdates(rows), ...(index === undefined ? {} : {sendEtaShipmentIndex:index})});
    shippingSaveStatus.value = error.value ? 'failed' : 'saved';
    sendingEtaIndex.value = null;
}

async function confirmReceipt() {
    await save({
        receivedStatus: 'received',
        receivedPhotos: photoNames.value,
        surplusItems: draft.surplusItems ?? [],
        status: 'complete',
    });
    if (!error.value) changingConfirmation.value = false;
}

function reportProblem() {
    reportingProblem.value = true;
    if (!draft.receivedStatus || draft.receivedStatus === 'shipped' || draft.receivedStatus === 'received') {
        draft.receivedStatus = 'damaged';
    }
}

function changeConfirmationResponse() {
    originalConfirmation.value = {
        receivedStatus: draft.receivedStatus,
        status: draft.status,
    };
    draft.receivedStatus = 'shipped';
    changingConfirmation.value = true;
}

function cancelConfirmationChange() {
    if (originalConfirmation.value) {
        draft.receivedStatus = originalConfirmation.value.receivedStatus;
        draft.status = originalConfirmation.value.status;
    }
    originalConfirmation.value = null;
    changingConfirmation.value = false;
    reportingProblem.value = false;
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
        receivedStatus: draft.receivedStatus,
        receivedPhotos: photoNames.value,
        surplusItems: draft.surplusItems ?? [],
        status:
            draft.receivedStatus === 'received'
                ? 'complete'
                : draft.receivedStatus === 'damaged'
                  ? 'damaged'
                : draft.receivedStatus === 'missing'
                  ? 'missing'
                  : draft.receivedStatus === 'incomplete'
                    ? 'needs_info'
                  : draft.status,
    });
    if (!error.value) {
        reportingProblem.value = false;
        changingConfirmation.value = false;
        originalConfirmation.value = null;
    }
    agencySaveStatus.value = error.value ? 'failed' : 'saved';
}

async function alertAgencyToConfirm() {
    agencyAlertSaving.value = true;
    agencyAlertMessage.value = '';
    try {
        await save({ agencyConfirmationAlertedAt: new Date().toISOString() });
        agencyAlertMessage.value = error.value ? 'Alert could not be recorded.' : 'Alert recorded.';
    } finally {
        agencyAlertSaving.value = false;
    }
}

function handlePhotos(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    photoNames.value = files.map((file) => file.name);
    draft.receivedPhotos = photoNames.value;
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
            </div>
            <div v-else class="detail-grid">
                <div><span>WIC Family ID</span><strong>{{ request.participantFamilyId ?? '—' }}</strong></div>
                <div><span>WIC Individual ID</span><strong>{{ request.wicIndividualId ?? '—' }}</strong></div>
                <div><span>Date of Birth</span><strong>{{ formatDisplayDate(request.participantDob) }}</strong></div>
                <div><span>Benefits Start Date</span><strong>{{ formatDisplayDate(request.benefitsStartDate) }}</strong></div>
                <div><span>Age at Benefits Start Date</span><strong>{{ participantAgeAtBenefitsStart(request.participantDob, request.benefitsStartDate) }}</strong></div>
                <div><span>Health Insurance</span><strong>{{ insuranceDetails(request) }}</strong></div>
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
                    <AdditionalFormulaFields v-model="editableFormulas[index]" :index="index + 1" auto-fit-justification />
                    <button v-if="index > 0" class="text-button" type="button" @click="editableFormulas.splice(index,1)">Remove Formula {{index + 1}}</button>
                </fieldset>
                <div v-if="editableFormulas.length < 2" class="detail-field-wide add-formula-action"><button class="button button-ghost add-formula-button" type="button" @click="editableFormulas.push(blankFormula())">Add another formula</button></div>
                <label class="field-label duration-field">Duration (in months) *<input required v-model.number="draft.durationMonths" class="form-input" type="number" min="1" max="6" /></label>
                <fieldset class="detail-field-wide diagnosis-editor">
                    <legend>Qualifying Diagnosis(es) *</legend>
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
            <div v-if="editingSection === 'food'" class="form-grid compact-form-grid">
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
        <section class="cdph-workspace" aria-label="CDPH/WIC Use Only">
            <header class="cdph-workspace-header"><h3>CDPH/WIC Use Only</h3></header>
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
            <div class="detail-grid cdph-product-details">
                <div><span>Formula Requested</span><strong>{{ request.productName }}</strong></div>
                <div><span>Product Number</span><strong>{{ selectedProduct?.productCode ?? '—' }}</strong></div>
                <div><span>Units Per Case</span><strong>{{ selectedProduct?.unitsPerCase ?? '—' }}</strong></div>
                <div><span>Yield</span><strong>{{ selectedProduct?.yield !== undefined ? `${selectedProduct.yield} fl oz` : '—' }}</strong></div>
            </div>
            <div class="issuance-heading">
                <h4>Issuance</h4>
            </div>
            <div class="form-grid compact-form-grid">
                <label class="field-label">
                    Approved Cases for Approved Months
                    <div class="case-month-input">
                        <input v-model.number="draft.approvedCases" class="form-input" type="number" min="0" aria-label="Approved Cases" />
                        <span>cases for</span>
                        <input v-model.number="draft.approvedMonths" class="form-input" type="number" min="0" aria-label="Approved Months" />
                        <span>months</span>
                    </div>
                </label>
                <label class="field-label">
                    Agency Units On Hand
                    <div class="surplus-input">
                        <input v-model.number="draft.agencyUnitsOnHand" class="form-input" type="number" min="0" />
                        <select v-model="draft.agencyUnitsOnHandUnit" class="form-input" aria-label="Agency Units On Hand Unit">
                            <option value="units">Units</option>
                            <option value="cases">Cases</option>
                        </select>
                    </div>
                </label>
                <label class="field-label">
                    Expected Surplus
                    <div class="surplus-input">
                        <input v-model.number="draft.expectedSurplus" class="form-input" type="number" min="0" />
                        <select v-model="draft.expectedSurplusUnit" class="form-input" aria-label="Expected Surplus Unit">
                            <option value="units">Units</option>
                            <option value="cases">Cases</option>
                        </select>
                    </div>
                </label>
            </div>
            <div class="benefit-allocation-editor">
                <div class="issuance-row-heading">
                    <h4>Select Month and Quantity</h4>
                    <button class="text-button" type="button" @click="addBenefitMonth">+ Add issuance month</button>
                </div>
                <div v-for="(issuance, index) in draft.benefitIssuances" :key="`${issuance.month}-${index}`" class="month-row">
                    <select v-model="issuance.month" class="form-input month-select">
                        <option value="">Select month</option>
                        <option v-for="month in benefitMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
                    </select>
                    <div class="quantity-input">
                        <input v-model.number="issuance.quantity" class="form-input month-quantity" type="number" min="1" placeholder="Quantity" />
                        <span>units</span>
                    </div>
                    <button class="icon-button" type="button" aria-label="Remove benefit month" @click="removeBenefitMonth(index)">×</button>
                </div>
            </div>
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

        <section class="detail-section">
            <h3>Shipping Info</h3>
            <div class="detail-grid shipping-contact-details">
                <div><span>Contact</span><strong>{{rep?.name || '—'}}</strong></div>
                <div><span>Phone Number</span><strong>{{(request.shipping?.phone || rep?.phone)?formatPhoneNumber(request.shipping?.phone || rep?.phone || ''):'—'}}</strong></div>
                <div class="detail-field-wide"><span>Email</span><strong>{{request.shipping?.email || rep?.email || '—'}}</strong></div>
            </div>
            <div v-if="request.shipping" class="shipping-address-field"><span class="detail-field-heading">Shipping Address</span><address class="shipping-preview shipping-destination"><strong>{{request.shipping.clinicName}}</strong><template v-if="rep?.name"><br />Attn: {{rep.name}}</template><br />{{request.shipping.addressLine1}}<template v-if="request.shipping.addressLine2"><br />{{request.shipping.addressLine2}}</template><br />{{request.shipping.city}}, {{request.shipping.state}} {{request.shipping.postalCode}}</address></div>
            <div class="shipment-list">
                <section v-for="(shipment,index) in canStaffEdit ? draft.shipments : requestShipments(request)" :key="index" class="shipment-card">
                    <div class="panel-heading"><h4>{{ (canStaffEdit ? draft.shipments?.length : requestShipments(request).length)! > 1 ? `Shipment ${index + 1}` : 'Shipment' }}</h4>
                        <button v-if="canStaffEdit && index > 0" type="button" class="text-button" @click="draft.shipments?.splice(index,1)">Remove shipment {{index + 1}}</button>
                    </div>
                    <div v-if="canStaffEdit" class="form-grid compact-form-grid">
                        <label class="field-label">ETA<input v-model="shipment.eta" class="form-input" type="date" :aria-label="`Shipment ${index + 1} ETA`" /></label>
                        <label class="field-label">Cases Shipped<input v-model.number="shipment.casesShipped" class="form-input" type="number" min="0" step="1" :aria-label="`Shipment ${index + 1} Cases Shipped`" /></label>
                        <label class="field-label detail-field-wide">Carrier<select v-model="shipment.carrier" class="form-input" :aria-label="`Shipment ${index + 1} Carrier`"><option value="fedex">FedEx</option><option value="dhl">DHL</option><option value="ups">UPS</option></select></label>
                        <label class="field-label detail-field-wide">Tracking Numbers<textarea :value="shipment.trackingNumbers.join('\n')" class="form-textarea" placeholder="Enter one tracking number per line." :aria-label="`Shipment ${index + 1} Tracking Numbers`" @input="setShipmentTracking(shipment, ($event.target as HTMLTextAreaElement).value)" /></label>
                    </div>
                    <div v-else class="detail-grid">
                        <div><span>ETA</span><strong>{{formatDisplayDate(shipment.eta)}}</strong></div>
                        <div><span>Cases Shipped</span><strong>{{shipment.casesShipped}}</strong></div>
                        <div><span>Carrier</span><strong>{{shipment.carrier.toUpperCase()}}</strong></div>
                        <div class="detail-field-wide"><span>Tracking Numbers</span><strong>{{shipment.trackingNumbers.join(', ') || 'N/A'}}</strong></div>
                    </div>
                    <div v-if="canStaffEdit" class="shipping-save-action">
                        <button class="button button-secondary" type="button" :disabled="saving" :aria-label="`Send ETA for shipment ${index + 1}`" @click="saveShipments(index)">{{ sendingEtaIndex === index ? 'Sending…' : 'Send ETA' }}</button>
                        <span v-if="shipment.etaSentAt" class="save-feedback save-feedback-saved">ETA sent</span>
                    </div>
                </section>
            </div>
            <template v-if="canStaffEdit">
                <button class="text-button" type="button" @click="draft.shipments = [...(draft.shipments ?? []), blankShipment()]">+ Add another shipment</button>
                <div class="shipping-save-action">
                    <button class="button button-ghost" type="button" :disabled="saving" @click="saveShipments()">Save Shipments</button>
                    <span v-if="shippingSaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${shippingSaveStatus}`" role="status">{{ shippingSaveStatus === 'saving' ? 'Saving…' : shippingSaveStatus === 'saved' ? 'Saved' : 'Save failed' }}</span>
                </div>
            </template>
        </section>
        </section>
        <hr class="cdph-section-divider" />

        <section
            v-if="canRepEdit || canStaffEdit"
            class="detail-section"
        >
            <h3>Confirmation</h3>
            <p v-if="canRepEdit" class="muted-copy">Add a note or update delivery after staff marks the request as shipped.</p>
            <div class="receipt-status" :class="`receipt-status-${draft.receivedStatus ?? 'shipped'}`">
                <span>Receipt Status</span>
                <strong>{{ receiptStatusLabel }}</strong>
            </div>
            <p v-if="canRepEdit && (draft.receivedStatus ?? 'shipped') === 'shipped' && draft.agencyConfirmationAlertedAt" class="confirmation-alert-notice">
                Staff asked your agency to confirm delivery.
            </p>
            <div v-if="canRepEdit && (draft.receivedStatus ?? 'shipped') !== 'shipped' && !changingConfirmation" class="confirmation-response-actions">
                <button class="button button-ghost" type="button" :disabled="saving" @click="changeConfirmationResponse">Change Response</button>
            </div>
            <div v-if="canRepEdit && ((draft.receivedStatus ?? 'shipped') === 'shipped' || changingConfirmation)" class="confirmation-response-actions">
                <button class="button button-secondary" type="button" :disabled="saving" @click="confirmReceipt">Confirm Receipt</button>
                <button class="button button-ghost" type="button" :disabled="saving" @click="reportProblem">Report Problem</button>
            </div>
            <label v-if="canRepEdit && reportingProblem" class="field-label">
                Problem Type
                <select v-model="draft.receivedStatus" class="form-input">
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                    <option value="incomplete">Incomplete</option>
                </select>
            </label>
            <label v-if="canRepEdit" class="field-label">
                Agency Notes
                <textarea v-model="draft.repNotes" class="form-textarea" />
            </label>
            <div v-else class="detail-grid">
                <div><span>Agency Notes</span><strong>{{ request.repNotes ?? '—' }}</strong></div>
            </div>
            <label v-if="canRepEdit && reportingProblem" class="field-label">
                Notes
                <textarea v-model="draft.repNotes" class="form-textarea" />
            </label>
            <div v-if="canStaffEdit && (draft.receivedStatus ?? 'shipped') === 'shipped'" class="confirmation-alert-action">
                <button class="button button-secondary" type="button" :disabled="saving || agencyAlertSaving" @click="alertAgencyToConfirm">
                    {{ agencyAlertSaving ? 'Alerting Agency…' : 'Alert Agency to Confirm' }}
                </button>
                <span v-if="agencyAlertMessage" class="save-feedback" role="status">{{ agencyAlertMessage }}</span>
            </div>
            <div
                v-if="canRepEdit && reportingProblem"
                class="form-grid compact-form-grid"
            >
                <label class="field-label">
                    Photos
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        @change="handlePhotos"
                    />
                </label>
            </div>
            <div v-if="canRepEdit && reportingProblem" class="confirmation-response-actions">
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveAgencyUpdate">Submit Problem Report</button>
                <button class="button button-ghost" type="button" :disabled="saving" @click="changingConfirmation ? cancelConfirmationChange() : (reportingProblem = false)">Cancel</button>
            </div>
            <p
                v-if="photoNames.length"
                class="muted-copy"
            >
                {{ photoNames.join(', ') }}
            </p>
            <div v-if="canStaffEdit && reportingSurplus" class="benefit-allocation-editor">
                <div class="panel-heading">
                    <div>
                        <h4>Surplus</h4>
                        <span>Use one row per formula and expiration date.</span>
                    </div>
                </div>
                <div v-for="(item, index) in draft.surplusItems" :key="index" class="surplus-entry-row">
                    <label class="field-label">Formula<input v-model="item.productName" class="form-input" /></label>
                    <label class="field-label">Units<input v-model.number="item.units" class="form-input" type="number" min="0" /></label>
                    <label class="field-label">Expiration<input v-model="item.expirationDate" class="form-input" type="date" /></label>
                    <button class="icon-button" type="button" aria-label="Remove surplus row" @click="requestRemoveSurplusItem(index)">×</button>
                </div>
                <div class="surplus-add-row-action">
                    <button class="text-button" type="button" @click="addSurplusItem">+ Add row</button>
                </div>
            </div>
            <div v-else-if="canStaffEdit" class="confirmation-response-actions">
                <button class="button button-primary report-surplus-button" type="button" @click="startSurplusReport">Report Surplus</button>
            </div>
            <div v-else-if="draft.surplusItems?.length" class="detail-grid">
                <div v-for="(item, index) in draft.surplusItems" :key="index">
                    <span>{{ item.productName || 'Surplus Product' }}</span>
                    <strong>{{ item.units }} units · Expires {{ formatDisplayDate(item.expirationDate) }}</strong>
                </div>
            </div>
            <div class="agency-save-action">
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

        <div v-if="pendingDecision" class="confirmation-backdrop" @click.self="pendingDecision = null">
            <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="deny-decision-title">
                <h3 id="deny-decision-title">Are you sure you want to deny this request?</h3>
                <p>This will remove the approved state and mark the request as denied.</p>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" @click="pendingDecision = null">Cancel</button>
                    <button class="button button-danger" type="button" @click="confirmDenial">Confirm denial</button>
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
