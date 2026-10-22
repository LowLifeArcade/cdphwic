<script setup lang="ts">
import type { ProductRecord, RequestRecord, RequestStatus } from '~/../shared/domain';
import { getNextBenefitMonth, validateBenefitIssuances, canGenerateAuthorizationForm, getApprovalStatus, canSelectShippedStatus } from '~/../shared/requestOperations';
import { normalizeRequestedMonths, validateRequestDetailNumbers, validateSurplusItems } from '~/../shared/requestDetailFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

type Agency = { name: string; shippingAddress: string; city: string; state: string; postalCode: string };
type Representative = { name: string; email: string; phone?: string };

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
const error = ref('');
const staffSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const photoNames = ref<string[]>([]);
const surplusRemovalIndex = ref<number | null>(null);
const editingSection = ref<'participant' | 'overview' | 'prescription' | null>(null);
const trackingCarrierFallback = ref<'fedex' | 'dhl' | 'ups'>('fedex');
const agencyAlertSaving = ref(false);
const agencyAlertMessage = ref('');
const agencySaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const reportingProblem = ref(false);
const changingConfirmation = ref(false);
const reportingSurplus = ref(false);
const originalConfirmation = ref<{ receivedStatus?: RequestRecord['receivedStatus']; status?: RequestRecord['status'] } | null>(null);
const previousDecision = ref<Partial<Pick<RequestRecord, 'status' | 'approved' | 'staffNotes'>> | null>(null);
const pendingDecision = ref<'denied' | null>(null);
const shippingSaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const canStaffEdit = computed(() => identity.value === 'admin' || identity.value === 'internal');
const canRepEdit = computed(() => identity.value === 'admin' || identity.value === 'agency');
const selectedProduct = computed(() => props.products?.find((product) => product.id === props.request?.productId));
const trackingCarrier = computed<'fedex' | 'dhl' | 'ups'>({
    get: () => draft.trackingNumbers?.[0]?.carrier ?? trackingCarrierFallback.value,
    set: (carrier) => {
        trackingCarrierFallback.value = carrier;
        draft.trackingNumbers = (draft.trackingNumbers ?? []).map((tracking) => ({ ...tracking, carrier }));
    },
});
const trackingNumbersText = computed({
    get: () => draft.trackingNumbers?.map((tracking) => tracking.number).join('\n') ?? '',
    set: (value: string) => {
        draft.trackingNumbers = value
            .split(/\r?\n/)
            .map((number) => number.trim())
            .filter(Boolean)
            .map((number) => ({ number, carrier: trackingCarrier.value }));
    },
});
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
            trackingCarrierFallback.value = request.trackingNumbers?.[0]?.carrier ?? 'fedex';
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

async function save(updates: Partial<RequestRecord> = draft) {
    if (!props.request) {
        return;
    }
    saving.value = true;
    error.value = '';
    try {
        const result = await $fetch<{ request: RequestRecord }>(`/api/requests/${props.request.id}`, {
            method: 'PUT',
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

function addTrackingNumber() {
    draft.trackingNumbers = [...(draft.trackingNumbers ?? []), { number: '', carrier: 'fedex' }];
}

function removeTrackingNumber(index: number) {
    draft.trackingNumbers?.splice(index, 1);
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
    const month = benefitMonths.value.find((option) => !selected.includes(option.value))?.value;
    if (month) draft.benefitMonthsRequested = [...selected, month].sort();
}

function removeRequestedMonth(index: number) {
    draft.benefitMonthsRequested = (draft.benefitMonthsRequested ?? []).filter((_, itemIndex) => itemIndex !== index);
}

function startEditing(section: 'participant' | 'overview' | 'prescription') {
    editingSection.value = section;
    error.value = '';
}

function cancelEditing() {
    if (props.request) Object.assign(draft, copyRequest(props.request));
    editingSection.value = null;
    error.value = '';
}

function saveFormSection() {
    const updates: Partial<RequestRecord> = {};
    if (editingSection.value === 'participant') {
        Object.assign(updates, {
            participantDob: draft.participantDob,
            benefitsStartDate: draft.benefitsStartDate,
            wicIndividualId: draft.wicIndividualId,
            medicalStatus: draft.medicalStatus,
        });
    } else if (editingSection.value === 'overview') {
        Object.assign(updates, {
            productName: draft.productName,
            productForm: draft.productForm,
            ouncesPrescribed: Number(draft.ouncesPrescribed),
            durationMonths: Number(draft.durationMonths),
            diagnosis: draft.diagnosis,
            benefitMonthsRequested: normalizeRequestedMonths(draft.benefitMonthsRequested),
        });
    } else if (editingSection.value === 'prescription') {
        Object.assign(updates, {
            doctorPrintedName: draft.doctorPrintedName,
            prescriptionSignedDate: draft.prescriptionSignedDate,
            doctorOfficeName: draft.doctorOfficeName,
            doctorOfficeAddress: draft.doctorOfficeAddress,
            doctorOfficePhone: normalizePhoneNumber(draft.doctorOfficePhone ?? ''),
        });
    }
    save(updates).then(() => {
        if (!error.value) editingSection.value = null;
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
        eta: draft.eta,
        trackingNumbers: draft.trackingNumbers,
        unitsIssued: Number(draft.unitsIssued),
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

async function shipRequest() {
    shippingSaveStatus.value = 'saving';
    const hasEta = Boolean(String(draft.eta ?? '').trim());
    const hasTrackingNumber = Boolean(draft.trackingNumbers?.some((tracking) => tracking.number.trim()));
    if (!hasEta || !hasTrackingNumber) {
        error.value = 'Enter an ETA and at least one tracking number before marking the request as shipped.';
        shippingSaveStatus.value = 'failed';
        return;
    }
    await save({
        status: 'shipped',
        eta: draft.eta,
        trackingNumbers: draft.trackingNumbers,
        unitsIssued: Number(draft.unitsIssued),
    });
    shippingSaveStatus.value = error.value ? 'failed' : 'saved';
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
    <aside
        v-if="request"
        class="detail-drawer"
        @click.stop
    >
        <div class="drawer-header">
            <div>
                <span class="eyebrow">Request #{{ request.id }}</span>
                <h2>{{ request.participantName }}</h2>
            </div>
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
        <div class="drawer-status">
            <div class="request-status-tags">
                <StatusBadge :status="draft.status ?? request.status" />
                <span class="request-tag">{{ request.requestKind === 'extension' ? 'Extension' : 'New' }}</span>
                <span
                    v-if="request.specialOrder"
                    class="request-tag"
                >Special order</span>
                <span
                    v-if="request.approved"
                    class="request-tag"
                >Approved</span>
            </div>
            <span>Submitted {{ request.submissionDate ?? '—' }}</span>
        </div>
        <section class="detail-section participant-summary">
            <div class="section-heading">
                <h3>Participant</h3>
                <button v-if="(canStaffEdit || canRepEdit) && editingSection !== 'participant'" class="text-button" type="button" @click="startEditing('participant')">Edit fields</button>
            </div>
            <div v-if="editingSection === 'participant'" class="form-grid compact-form-grid">
                <label class="field-label">WIC Individual ID<input v-model="draft.wicIndividualId" class="form-input" /></label>
                <label class="field-label">Date of Birth<input v-model="draft.participantDob" class="form-input" type="date" /></label>
                <label class="field-label">Medi-Cal<select v-model="draft.medicalStatus" class="form-input"><option value="pending">Pending</option><option value="yes">Yes</option><option value="no">No</option></select></label>
                <label class="field-label">Benefits Start Date<input v-model="draft.benefitsStartDate" class="form-input" type="date" /></label>
            </div>
            <div v-else class="detail-grid">
                <div><span>WIC Family ID</span><strong>{{ request.participantFamilyId ?? '—' }}</strong></div>
                <div><span>WIC Individual ID</span><strong>{{ request.wicIndividualId ?? '—' }}</strong></div>
                <div><span>Date of Birth</span><strong>{{ formatDisplayDate(request.participantDob) }}</strong></div>
                <div><span>Medi-Cal</span><strong>{{ formatTitleCase(request.medicalStatus) }}</strong></div>
                <div><span>Benefits Start Date</span><strong>{{ formatDisplayDate(request.benefitsStartDate) }}</strong></div>
            </div>
            <div v-if="editingSection === 'participant'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save fields</button>
            </div>
        </section>
        <p
            v-if="error"
            class="form-error"
        >
            {{ error }}
        </p>
        <section class="detail-section">
            <div class="section-heading">
                <h3>Prescription</h3>
                <button v-if="(canStaffEdit || canRepEdit) && editingSection !== 'overview'" class="text-button" type="button" @click="startEditing('overview')">Edit fields</button>
            </div>
            <div v-if="editingSection === 'overview'" class="form-grid compact-form-grid">
                <label class="field-label">Formula<input v-model="draft.productName" class="form-input" /></label>
                <label class="field-label">Form<select v-model="draft.productForm" class="form-input"><option value="powder">Powder</option><option value="concentrate">Concentrate</option><option value="ready-to-feed">Ready to feed</option></select></label>
                <label class="field-label">Amount Prescribed<input v-model.number="draft.ouncesPrescribed" class="form-input" type="number" min="1" /></label>
                <label class="field-label">Duration (Months)<input v-model.number="draft.durationMonths" class="form-input" type="number" min="1" max="6" /></label>
                <label class="field-label">Diagnosis<input v-model="draft.diagnosis" class="form-input" /></label>
            </div>
            <div v-else class="detail-grid">
                <div><span>Formula</span><strong>{{ request.productName }}</strong></div>
                <div><span>Form</span><strong>{{ formatTitleCase(request.productForm) }}</strong></div>
                <div><span>Amount Prescribed</span><strong>{{ request.ouncesPrescribed ?? '—' }} oz</strong></div>
                <div><span>Duration</span><strong>{{ request.durationMonths ?? '—' }} months</strong></div>
                <div><span>Diagnosis</span><strong>{{ request.diagnosis ?? '—' }}</strong></div>
            </div>
            <div class="detail-grid requested-months-field">
                <div>
                    <span>Benefit Month(s) Requested</span>
                    <strong v-if="editingSection !== 'overview'">{{ (draft.benefitMonthsRequested ?? []).map((month) => benefitMonths.find((option) => option.value === month)?.label ?? month).join(', ') || '—' }}</strong>
                    <div v-else class="month-list">
                        <div v-for="(month, index) in draft.benefitMonthsRequested" :key="`${month}-${index}`" class="month-row">
                            <select v-model="draft.benefitMonthsRequested[index]" class="form-input">
                                <option v-for="option in benefitMonths" :key="option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                            <button class="icon-button" type="button" :aria-label="`Remove ${month}`" @click="removeRequestedMonth(index)">×</button>
                        </div>
                        <button class="text-button" type="button" @click="addRequestedMonth">+ Add requested month</button>
                    </div>
                </div>
            </div>
            <div v-if="editingSection === 'overview'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save fields</button>
            </div>
            <div class="submitted-prescription">
                <div class="panel-heading">
                    <div>
                        <h4>Submitted prescription form</h4>
                        <span v-if="request.prescriptionAttachment">{{ request.prescriptionAttachment.fileName }}</span>
                        <span v-else>No prescription form uploaded.</span>
                    </div>
                    <a
                        v-if="request.prescriptionAttachment"
                        class="text-button"
                        :href="`/api/requests/${request.id}/prescription`"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open form
                    </a>
                </div>
                <iframe
                    v-if="request.prescriptionAttachment?.contentType === 'application/pdf'"
                    class="prescription-preview"
                    :src="`/api/requests/${request.id}/prescription`"
                    title="Submitted prescription form"
                />
                <img
                    v-else-if="request.prescriptionAttachment"
                    class="prescription-preview prescription-image-preview"
                    :src="`/api/requests/${request.id}/prescription`"
                    alt="Submitted prescription form"
                />
            </div>
        </section>
        <section class="detail-section">
            <h3>Local Agency</h3>
            <div class="detail-grid">
                <div>
                    <span>Local Agency</span><strong>{{ agency?.name ?? '—' }}</strong>
                </div>
                <div>
                    <span>Shipping Address</span><strong>{{ agency ? `${agency.shippingAddress}, ${agency.city}, ${agency.state} ${agency.postalCode}` : '—' }}</strong>
                </div>
                <div>
                    <span>Contact</span><strong>{{ rep?.name ?? '—' }}</strong>
                </div>
                <div>
                    <span>Email</span><strong>{{ rep?.email ?? '—' }}</strong>
                </div>
                <div>
                    <span>Phone</span><strong>{{ rep?.phone ?? '—' }}</strong>
                </div>
            </div>
        </section>
        <section class="detail-section">
            <div class="section-heading">
                <h3>Health Care Provider</h3>
                <button v-if="(canStaffEdit || canRepEdit) && editingSection !== 'prescription'" class="text-button" type="button" @click="startEditing('prescription')">Edit fields</button>
            </div>
            <div v-if="editingSection === 'prescription'" class="form-grid compact-form-grid">
                <label class="field-label">Doctor<input v-model="draft.doctorPrintedName" class="form-input" /></label>
                <label class="field-label">Signed Date<input v-model="draft.prescriptionSignedDate" class="form-input" type="date" /></label>
                <label class="field-label">Office<input v-model="draft.doctorOfficeName" class="form-input" /></label>
                <label class="field-label">Office Address<input v-model="draft.doctorOfficeAddress" class="form-input" /></label>
                <label class="field-label">Office Phone<input v-model="draft.doctorOfficePhone" class="form-input" type="tel" @input="formatDoctorPhone" /></label>
            </div>
            <div v-else class="detail-grid">
                <div><span>Doctor</span><strong>{{ request.doctorPrintedName ?? '—' }}</strong></div>
                <div><span>Signed Date</span><strong>{{ formatDisplayDate(request.prescriptionSignedDate) }}</strong></div>
                <div><span>Office</span><strong>{{ request.doctorOfficeName ?? '—' }}</strong></div>
                <div><span>Office Address</span><strong>{{ request.doctorOfficeAddress ?? '—' }}</strong></div>
                <div><span>Office Phone</span><strong>{{ request.doctorOfficePhone ? formatPhoneNumber(request.doctorOfficePhone) : '—' }}</strong></div>
            </div>
            <div v-if="editingSection === 'prescription'" class="form-actions">
                <button class="button button-ghost" type="button" @click="cancelEditing">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="saveFormSection">Save fields</button>
            </div>
        </section>
        <section
            v-if="canStaffEdit"
            class="detail-section"
        >
            <div class="panel-heading">
                <div>
                    <h3>CDPH/WIC Use Only</h3>
                </div>
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
                    <span>Select Month and Quantity</span>
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
            <div v-if="canStaffEdit" class="form-grid compact-form-grid">
                <label class="field-label">
                    ETA
                    <input v-model="draft.eta" class="form-input" type="date" />
                </label>
                <label class="field-label">
                    Cases Shipped
                    <input v-model.number="draft.unitsIssued" class="form-input" type="number" min="0" />
                </label>
            </div>
            <div v-if="canStaffEdit" class="tracking-editor">
                <div class="panel-heading">
                    <h4>Tracking</h4>
                </div>
                <label class="field-label">
                    Carrier
                    <select v-model="trackingCarrier" class="form-input">
                        <option value="fedex">FedEx</option>
                        <option value="dhl">DHL</option>
                        <option value="ups">UPS</option>
                    </select>
                </label>
                <label class="field-label">
                    Tracking Numbers
                    <textarea v-model="trackingNumbersText" class="form-textarea" placeholder="Enter one tracking number per line." />
                </label>
                <div class="shipping-save-action">
                    <button class="button button-secondary" type="button" :disabled="saving" @click="shipRequest">
                        {{ shippingSaveStatus === 'saving' ? 'SAVING…' : 'Shipped' }}
                    </button>
                    <span v-if="shippingSaveStatus !== 'idle'" class="save-feedback" :class="`save-feedback-${shippingSaveStatus}`" role="status">
                        {{ shippingSaveStatus === 'saving' ? 'Saving…' : shippingSaveStatus === 'saved' ? 'Saved' : 'Save failed' }}
                    </span>
                </div>
            </div>
            <div v-else class="detail-grid">
                <div>
                    <span>ETA</span><strong>{{ formatDisplayDate(request.eta) === '—' ? 'Not set' : formatDisplayDate(request.eta) }}</strong>
                </div>
                <div>
                    <span>Tracking</span><strong>{{ request.trackingNumbers?.length ? request.trackingNumbers.map((item) => `${item.number} (${item.carrier.toUpperCase()})`).join(', ') : 'N/A' }}</strong>
                </div>
            </div>
        </section>

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
            <div v-if="canRepEdit && reportingSurplus" class="benefit-allocation-editor">
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
            <div v-else-if="canRepEdit" class="confirmation-response-actions">
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
