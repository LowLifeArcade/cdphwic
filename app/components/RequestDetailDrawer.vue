<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';

const props = defineProps<{ request: RequestRecord | null }>();
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
    };
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
                    @change="save({ status: draft.status })"
                >
                    <option value="opened">Opened</option>
                    <option value="in_progress">In progress</option>
                    <option value="needs_info">Need info</option>
                    <option value="shipped">Shipped</option>
                    <option value="complete">Complete</option>
                </select>
            </label>
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
            <label class="field-label">
                Benefit issuance start month
                <input
                    v-model="draft.benefitIssuanceStartMonth"
                    class="form-input"
                    type="month"
                />
            </label>
            <label class="field-label">
                Benefit issuance end month
                <input
                    v-model="draft.benefitIssuanceEndMonth"
                    class="form-input"
                    type="month"
                />
            </label>
            <label class="field-label">
                Give reason above staff notes
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
                    @click="
                        save({
                            staffNotes: draft.staffNotes,
                            benefitIssuanceStartMonth: draft.benefitIssuanceStartMonth,
                            benefitIssuanceEndMonth: draft.benefitIssuanceEndMonth,
                        })
                    "
                >
                    Save staff notes
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
