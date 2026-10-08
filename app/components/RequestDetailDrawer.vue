<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
import { getNextBenefitMonth, validateBenefitIssuances, canGenerateAuthorizationForm } from '~/../shared/requestOperations';

type Agency = { name: string; shippingAddress: string; city: string; state: string; postalCode: string };
type Representative = { name: string; email: string; phone?: string };

const props = defineProps<{
    request: RequestRecord | null;
    agency?: Agency;
    rep?: Representative;
}>();
const emit = defineEmits<{ close: [] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const draft = reactive<Partial<RequestRecord>>({});
const saving = ref(false);
const error = ref('');
const photoNames = ref<string[]>([]);
const canStaffEdit = computed(() => identity.value === 'admin' || identity.value === 'internal');
const canRepEdit = computed(() => identity.value === 'admin' || identity.value === 'agency');

function copyRequest(request: RequestRecord): Partial<RequestRecord> {
    return {
        ...request,
        trackingNumbers: request.trackingNumbers?.map((tracking) => ({ ...tracking })),
        receivedPhotos: request.receivedPhotos ? [...request.receivedPhotos] : undefined,
        benefitIssuances: request.benefitIssuances?.map((issuance) => ({ ...issuance })) ?? [],
    };
}

const benefitMonths = computed(() => {
    const start = props.request?.benefitsStartDate ?? new Date().toISOString().slice(0, 7) + '-01';
    const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    return Array.from({ length: 24 }, (_, index) => {
        const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index, 1));
        const value = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
        return { value, label: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
    });
});

watch(
    () => props.request,
    (request) => {
        Object.keys(draft).forEach((key) => delete draft[key as keyof typeof draft]);
        if (request) {
            Object.assign(draft, copyRequest(request));
        }
        photoNames.value = request?.receivedPhotos ? [...request.receivedPhotos] : [];
        error.value = '';
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

function saveStaffFields() {
    const issuances = draft.benefitIssuances ?? [];
    const validationErrors = validateBenefitIssuances(issuances);
    if (validationErrors.length) {
        error.value = validationErrors[0];
        return;
    }
    save({
        participantDob: draft.participantDob,
        benefitsStartDate: draft.benefitsStartDate,
        productName: draft.productName,
        productForm: draft.productForm,
        ouncesPrescribed: Number(draft.ouncesPrescribed),
        durationMonths: Number(draft.durationMonths),
        diagnosis: draft.diagnosis,
        doctorPrintedName: draft.doctorPrintedName,
        doctorOfficeName: draft.doctorOfficeName,
        doctorOfficeAddress: draft.doctorOfficeAddress,
        doctorOfficePhone: draft.doctorOfficePhone,
        benefitIssuances: issuances,
        staffNotes: draft.staffNotes,
    });
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
                <span class="request-tag">{{ request.requestKind === 'extension' ? 'Extension' : 'New' }}</span>
            </div>
            <button
                class="icon-button"
                aria-label="Close details"
                @click="emit('close')"
            >
                ×
            </button>
        </div>
        <div class="drawer-status">
            <StatusBadge :status="draft.status ?? request.status" />
            <span>Submitted {{ request.submissionDate ?? '—' }}</span>
            <span
                v-if="request.specialOrder"
                class="request-tag"
                >Special order</span
            >
        </div>
        <p
            v-if="error"
            class="form-error"
        >
            {{ error }}
        </p>
        <section class="detail-section">
            <h3>Request overview</h3>
            <div class="detail-grid">
                <div>
                    <span>Formula</span><strong>{{ request.productName }}</strong>
                </div>
                <div>
                    <span>Form</span><strong>{{ request.productForm ?? '—' }}</strong>
                </div>
                <div>
                    <span>Medi-Cal status</span><strong>{{ request.medicalStatus ?? 'Pending' }}</strong>
                </div>
                <div>
                    <span>Amount prescribed</span><strong>{{ request.ouncesPrescribed ?? '—' }} oz</strong>
                </div>
                <div>
                    <span>Duration</span><strong>{{ request.durationMonths ?? '—' }} months</strong>
                </div>
                <div>
                    <span>Benefits start</span><strong>{{ request.benefitsStartDate ?? '—' }}</strong>
                </div>
            </div>
        </section>
        <section class="detail-section">
            <h3>Participant</h3>
            <div class="detail-grid">
                <div>
                    <span>WIC family ID</span><strong>{{ request.participantFamilyId ?? '—' }}</strong>
                </div>
                <div>
                    <span>WIC individual ID</span><strong>{{ request.wicIndividualId ?? '—' }}</strong>
                </div>
                <div>
                    <span>Date of birth</span><strong>{{ request.participantDob ?? '—' }}</strong>
                </div>
                <div>
                    <span>Diagnosis</span><strong>{{ request.diagnosis ?? '—' }}</strong>
                </div>
            </div>
        </section>
        <section class="detail-section">
            <h3>Local agency and representative</h3>
            <div class="detail-grid">
                <div>
                    <span>Local agency</span><strong>{{ agency?.name ?? '—' }}</strong>
                </div>
                <div>
                    <span>Address</span><strong>{{ agency ? `${agency.shippingAddress}, ${agency.city}, ${agency.state} ${agency.postalCode}` : '—' }}</strong>
                </div>
                <div>
                    <span>LA representative</span><strong>{{ rep?.name ?? '—' }}</strong>
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
            <h3>Delivery</h3>
            <div class="detail-grid">
                <div>
                    <span>ETA</span><strong>{{ request.eta ?? 'Not set' }}</strong>
                </div>
                <div>
                    <span>Tracking</span
                    ><strong>{{
                        request.trackingNumbers?.length
                            ? request.trackingNumbers.map((item) => item.number).join(', ')
                            : 'N/A'
                    }}</strong>
                </div>
            </div>
        </section>

        <section
            v-if="canStaffEdit"
            class="detail-section"
        >
            <div class="panel-heading">
                <div>
                    <h3>Staff processing</h3>
                    <span>Staff-only fields</span>
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
                    v-model="draft.status"
                    class="form-input"
                    @change="draft.status === 'denied' ? undefined : save({ status: draft.status })"
                >
                    <option value="opened">Opened</option>
                    <option value="in_progress">In progress</option>
                    <option value="needs_info">Need info</option>
                    <option value="shipped">Shipped</option>
                    <option value="complete">Complete</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                </select>
            </label>
            <div class="form-grid compact-form-grid">
                <label class="field-label">
                    Participant DOB
                    <input
                        v-model="draft.participantDob"
                        class="form-input"
                        type="date"
                    />
                </label>
                <label class="field-label">
                    Benefits Start Date
                    <input
                        v-model="draft.benefitsStartDate"
                        class="form-input"
                        type="date"
                    />
                </label>
                <label class="field-label">
                    Formula
                    <input
                        v-model="draft.productName"
                        class="form-input"
                    />
                </label>
                <label class="field-label">
                    Formula form
                    <select
                        v-model="draft.productForm"
                        class="form-input"
                    >
                        <option value="powder">Powder</option>
                        <option value="concentrate">Concentrate</option>
                        <option value="ready-to-feed">Ready to feed</option>
                    </select>
                </label>
                <label class="field-label">
                    Amount prescribed
                    <input
                        v-model.number="draft.ouncesPrescribed"
                        class="form-input"
                        type="number"
                        min="1"
                    />
                </label>
                <label class="field-label">
                    Duration (months)
                    <input
                        v-model.number="draft.durationMonths"
                        class="form-input"
                        type="number"
                        min="1"
                        max="6"
                    />
                </label>
                <label class="field-label">
                    Diagnosis
                    <input
                        v-model="draft.diagnosis"
                        class="form-input"
                    />
                </label>
                <label class="field-label">
                    Doctor printed name
                    <input v-model="draft.doctorPrintedName" class="form-input" />
                </label>
                <label class="field-label">
                    Doctor office name
                    <input v-model="draft.doctorOfficeName" class="form-input" />
                </label>
                <label class="field-label">
                    Doctor office address
                    <input v-model="draft.doctorOfficeAddress" class="form-input" />
                </label>
                <label class="field-label">
                    Doctor office phone
                    <input v-model="draft.doctorOfficePhone" class="form-input" type="tel" />
                </label>
            </div>
            <div
                v-if="draft.status === 'shipped'"
                class="form-grid compact-form-grid"
            >
                <label class="field-label">
                    ETA
                    <input
                        v-model="draft.eta"
                        class="form-input"
                        type="date"
                        @change="save({ eta: draft.eta })"
                    />
                </label>
                <label class="field-label">
                    Units issued
                    <input
                        v-model.number="draft.unitsIssued"
                        class="form-input"
                        type="number"
                        min="0"
                    />
                </label>
            </div>
            <div
                v-if="draft.status === 'shipped'"
                class="tracking-editor"
            >
                <div class="panel-heading">
                    <h4>Tracking numbers</h4>
                    <button
                        class="text-button"
                        type="button"
                        @click="addTrackingNumber"
                    >
                        + Add number
                    </button>
                </div>
                <div
                    v-for="(tracking, index) in draft.trackingNumbers"
                    :key="index"
                    class="tracking-row"
                >
                    <input
                        v-model="tracking.number"
                        class="form-input"
                        placeholder="Tracking number"
                    />
                    <select
                        v-model="tracking.carrier"
                        class="form-input"
                    >
                        <option value="fedex">FedEx</option>
                        <option value="dhl">DHL</option>
                        <option value="ups">UPS</option>
                    </select>
                    <button
                        class="icon-button"
                        type="button"
                        aria-label="Remove tracking number"
                        @click="removeTrackingNumber(index)"
                    >
                        ×
                    </button>
                </div>
                <button
                    class="button button-ghost"
                    type="button"
                    :disabled="saving"
                    @click="save({ trackingNumbers: draft.trackingNumbers, unitsIssued: draft.unitsIssued })"
                >
                    Save delivery details
                </button>
            </div>
            <div class="benefit-allocation-editor">
                <div class="panel-heading">
                    <div>
                        <h4>Benefit issuance</h4>
                        <span>Select a month and quantity for each issuance.</span>
                    </div>
                    <button
                        class="text-button"
                        type="button"
                        @click="addBenefitMonth"
                    >
                        + Add benefit month
                    </button>
                </div>
                <div
                    v-for="(issuance, index) in draft.benefitIssuances"
                    :key="index"
                    class="tracking-row"
                >
                    <select
                        v-model="issuance.month"
                        class="form-input"
                    >
                        <option value="">Select month</option>
                        <option
                            v-for="month in benefitMonths"
                            :key="month.value"
                            :value="month.value"
                        >
                            {{ month.label }}
                        </option>
                    </select>
                    <input
                        v-model.number="issuance.quantity"
                        class="form-input"
                        type="number"
                        min="1"
                        placeholder="Quantity"
                    />
                    <button
                        class="icon-button"
                        type="button"
                        aria-label="Remove benefit month"
                        @click="removeBenefitMonth(index)"
                    >
                        ×
                    </button>
                </div>
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
            <div class="form-actions drawer-actions">
                <button
                    class="button button-secondary"
                    type="button"
                    :disabled="saving"
                    @click="saveStaffFields"
                >
                    Save staff updates
                </button>
                <button
                    class="button button-danger"
                    type="button"
                    :disabled="saving"
                    @click="denyRequest"
                >
                    Deny request
                </button>
            </div>
            <a
                v-if="canGenerateAuthorizationForm(request)"
                class="button button-secondary"
                :href="`/api/requests/${request.id}/authorization-form.pdf`"
                target="_blank"
                rel="noreferrer"
            >
                Download Authorization Form
            </a>
        </section>

        <section
            v-if="canRepEdit"
            class="detail-section"
        >
            <h3>Agency follow-up</h3>
            <p class="muted-copy">Add a note or update delivery after staff marks the request as shipped.</p>
            <label class="field-label">
                Agency notes
                <textarea
                    v-model="draft.repNotes"
                    class="form-textarea"
                />
            </label>
            <div
                v-if="draft.status === 'shipped'"
                class="form-grid compact-form-grid"
            >
                <label class="field-label">
                    Received status
                    <select
                        v-model="draft.receivedStatus"
                        class="form-input"
                    >
                        <option value="shipped">Back to shipped</option>
                        <option value="received">Received</option>
                        <option value="damaged">Damaged</option>
                        <option value="missing">Missing</option>
                    </select>
                </label>
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
            <p
                v-if="photoNames.length"
                class="muted-copy"
            >
                {{ photoNames.join(', ') }}
            </p>
            <button
                class="button button-secondary"
                type="button"
                :disabled="saving"
                @click="
                    save({
                        repNotes: draft.repNotes,
                        receivedStatus: draft.receivedStatus,
                        receivedPhotos: photoNames,
                        status: draft.receivedStatus === 'received' ? 'complete' : draft.status,
                    })
                "
            >
                Save agency update
            </button>
        </section>

        <section class="detail-section">
            <h3>Prescription</h3>
            <div class="detail-grid">
                <div>
                    <span>Doctor</span><strong>{{ request.doctorPrintedName ?? '—' }}</strong>
                </div>
                <div>
                    <span>Signed date</span><strong>{{ request.prescriptionSignedDate ?? '—' }}</strong>
                </div>
                <div>
                    <span>Office</span><strong>{{ request.doctorOfficeName ?? '—' }}</strong>
                </div>
                <div>
                    <span>Office phone</span><strong>{{ request.doctorOfficePhone ?? '—' }}</strong>
                </div>
            </div>
        </section>
    </aside>
</template>
