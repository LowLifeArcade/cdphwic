<script setup lang="ts">
import type { ProductForm } from '~/../shared/domain';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const submitted = ref(false);
const parsing = ref(false);
const parserMessage = ref('');
const parserError = ref('');
const parserMissing = ref<string[]>([]);
const selectedPrescription = ref<File | null>(null);
const uploadedStorageKey = ref('');
const removeConfirmationOpen = ref(false);
let removeConfirmationResolver: ((confirmed: boolean) => void) | undefined;
const { data: productData } = await useFetch('/api/products');
const products = computed(() => productData.value?.products ?? []);
const form = reactive({
    patientFirstName: '',
    patientLastName: '',
    participantDob: '',
    familyId: '',
    individualId: '',
    benefitsStartDate: '',
    requestKind: 'new' as 'new' | 'extension',
    productId: '',
    otherFormulaName: '',
    productForm: 'powder' as ProductForm,
    readyToFeedJustification: '',
    medicalStatus: 'pending',
    diagnosis: '',
    ouncesPrescribed: '',
    durationMonths: '1',
    doctorPrintedName: '',
    doctorHasSignedOff: false,
    doctorOfficeName: '',
    doctorOfficeAddress: '',
    doctorOfficePhone: '',
    prescriptionSignedDate: '',
    additionalNotes: '',
});

const selectedProduct = computed(() => products.value.find((product) => product.id === Number(form.productId)));
const productName = computed(() =>
    form.productId === 'other' ? form.otherFormulaName : (selectedProduct.value?.name ?? 'Formula to be selected'),
);

function requiredLabel(label: string) {
    return `${label} *`;
}

async function processPrescription(file: File) {
    parserError.value = '';
    parserMessage.value = '';
    parserMissing.value = [];
    parsing.value = true;
    const body = new FormData();
    body.append('prescription', file);
    try {
        const result = await $fetch<{
            message: string;
            missing: string[];
            storageKey: string;
            extracted: {
                patientFirstName: string;
                patientLastName: string;
                participantDob: string;
                doctorPrintedName: string;
                doctorOfficeName: string;
                doctorOfficeAddress: string;
                medicalStatus: 'yes' | 'no' | 'pending';
                productForm?: ProductForm;
                readyToFeedJustification: string;
                ouncesPrescribed?: number;
                durationMonths?: number;
                diagnosis: string;
                doctorOfficePhone: string;
                prescriptionSignedDate: string;
                additionalNotes: string;
            };
        }>('/api/requests/parse-prescription', { method: 'POST', body });
        Object.assign(form, {
            ...result.extracted,
            doctorOfficePhone: formatPhoneNumber(result.extracted.doctorOfficePhone),
        });
        parserMessage.value = result.message;
        parserMissing.value = result.missing;
        uploadedStorageKey.value = result.storageKey;
    } catch (requestError) {
        parserError.value =
            (requestError as { statusMessage?: string }).statusMessage ?? 'Prescription could not be read.';
    } finally {
        parsing.value = false;
    }
}

function formatDoctorPhone(event: Event) {
    const input = event.target as HTMLInputElement;
    form.doctorOfficePhone = formatPhoneNumber(input.value);
    input.value = form.doctorOfficePhone;
}

function requestRemoveConfirmation() {
    if (!selectedPrescription.value) {
        return Promise.resolve(true);
    }

    removeConfirmationOpen.value = true;
    return new Promise<boolean>((resolve) => {
        removeConfirmationResolver = resolve;
    });
}

function resolveRemoveConfirmation(confirmed: boolean) {
    removeConfirmationOpen.value = false;
    const resolve = removeConfirmationResolver;
    removeConfirmationResolver = undefined;
    resolve?.(confirmed);
}

async function removePrescription() {
    if (!(await requestRemoveConfirmation())) {
        return false;
    }

    try {
        if (uploadedStorageKey.value) {
            await $fetch('/api/requests/prescription-upload', {
                method: 'DELETE',
                body: { key: uploadedStorageKey.value },
            });
        }
        selectedPrescription.value = null;
        uploadedStorageKey.value = '';
        parserMessage.value = '';
        parserMissing.value = [];
        if (fileInput.value) {
            fileInput.value.value = '';
        }
        return true;
    } catch (requestError) {
        parserError.value =
            (requestError as { statusMessage?: string }).statusMessage ?? 'The prescription could not be removed.';
        return false;
    }
}

async function selectPrescription(file: File | undefined) {
    if (!file) {
        return;
    }
    if (selectedPrescription.value && !(await removePrescription())) {
        return;
    }
    selectedPrescription.value = file;
    await processPrescription(file);
}

async function handleFileSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    await selectPrescription(input.files?.[0]);
}

async function handleDrop(event: DragEvent) {
    await selectPrescription(event.dataTransfer?.files?.[0]);
}

async function submitRequest() {
    submitted.value = false;
    const participantName = `${form.patientFirstName} ${form.patientLastName}`.trim();
    const body = new FormData();
    body.append(
        'request',
        JSON.stringify({
            agencyId: 10,
            agencyMemberId: 100,
            participantName,
            participantFirstName: form.patientFirstName,
            participantLastName: form.patientLastName,
            participantDob: form.participantDob,
            participantFamilyId: Number(form.familyId) || undefined,
            wicIndividualId: form.individualId || undefined,
            benefitsStartDate: form.benefitsStartDate,
            requestKind: form.requestKind,
            productId: form.productId === 'other' ? -1 : selectedProduct.value?.id,
            productName: productName.value,
            productForm: form.productForm,
            medicalStatus: form.medicalStatus,
            diagnosis: form.diagnosis,
            ouncesPrescribed: Number(form.ouncesPrescribed),
            durationMonths: Number(form.durationMonths),
            doctorPrintedName: form.doctorPrintedName,
            doctorHasSignedOff: form.doctorHasSignedOff,
            doctorOfficeName: form.doctorOfficeName,
            doctorOfficeAddress: form.doctorOfficeAddress,
            doctorOfficePhone: normalizePhoneNumber(form.doctorOfficePhone),
            prescriptionSignedDate: form.prescriptionSignedDate,
            prescriptionKey: uploadedStorageKey.value || undefined,
            status: 'unopened',
            genericFields: {
                readyToFeedJustification: form.readyToFeedJustification,
                additionalNotes: form.additionalNotes,
            },
        }),
    );
    await $fetch('/api/requests', { method: 'POST', body });
    submitted.value = true;
    await router.push('/requests');
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Requests</p>
            <h1>New request</h1>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/requests"
            >Cancel</NuxtLink
        >
    </div>
    <form
        class="panel form-panel request-form"
        @submit.prevent="submitRequest"
    >
        <section class="form-section prescription-first">
            <div class="panel-heading">
                <div>
                    <h2>Medical Documentation</h2>
                </div>
            </div>
            <div class="prescription-requirements">
                <strong>Before uploading, check that the medical documentation includes:</strong>
                <ul>
                    <li>Patient first name, last name, and date of birth</li>
                    <li>Formula name, formula form, ounces prescribed, and duration in months</li>
                    <li>Provider printed name and signature</li>
                    <li>Provider office name, address, and phone number</li>
                    <li>Date signed</li>
                </ul>
            </div>
            <div
                class="upload-drop"
                @dragover.prevent
                @drop.prevent="handleDrop"
            >
                <template v-if="!selectedPrescription">
                    <strong>Drag and drop medical documentation here.</strong>
                    <span>Choose a PDF or photo. PDFs populate matching form fields; photos require manual entry.</span>
                    <input
                        ref="fileInput"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        @change="handleFileSelection"
                    />
                </template>
                <template v-else>
                    <div
                        v-if="parsing"
                        class="upload-processing"
                    >
                        <span
                            class="loading-spinner"
                            aria-hidden="true"
                        />
                        Processing {{ selectedPrescription.name }}…
                    </div>
                    <div
                        v-else
                        class="uploaded-file"
                    >
                        <span>{{ selectedPrescription.name }}</span>
                        <button
                            type="button"
                            aria-label="Remove uploaded prescription"
                            @click="removePrescription()"
                        >
                            ×
                        </button>
                    </div>
                </template>
            </div>
            <p
                v-if="parserMessage"
                class="success-copy"
            >
                {{ parserMessage }}
            </p>
            <p
                v-if="parserMissing.length"
                class="muted-copy"
            >
                Parser fields still needing review: {{ parserMissing.join(', ') }}
            </p>
            <p
                v-if="parserError"
                class="form-error"
            >
                {{ parserError }}
            </p>
        </section>

        <div
            v-if="removeConfirmationOpen && selectedPrescription"
            class="confirmation-backdrop"
            role="presentation"
            @click.self="resolveRemoveConfirmation(false)"
        >
            <section
                class="confirmation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="remove-prescription-title"
            >
                <h2 id="remove-prescription-title">Remove uploaded prescription?</h2>
                <p>
                    Remove <strong>{{ selectedPrescription.name }}</strong>? The temporary upload will also be removed
                    from storage.
                </p>
                <div class="form-actions">
                    <button
                        class="button button-ghost"
                        type="button"
                        @click="resolveRemoveConfirmation(false)"
                    >
                        Keep file
                    </button>
                    <button
                        class="button button-danger"
                        type="button"
                        @click="resolveRemoveConfirmation(true)"
                    >
                        Remove file
                    </button>
                </div>
            </section>
        </div>

        <section class="form-section">
            <div class="panel-heading">
                <div>
                    <h2>Participant</h2>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-field">
                    <label for="patient-first">{{ requiredLabel('Patient First Name') }}</label>
                    <input
                        id="patient-first"
                        v-model="form.patientFirstName"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="patient-last">{{ requiredLabel('Patient Last Name') }}</label>
                    <input
                        id="patient-last"
                        v-model="form.patientLastName"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="dob">{{ requiredLabel('Date of Birth') }}</label>
                    <input
                        id="dob"
                        v-model="form.participantDob"
                        class="form-input"
                        type="date"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="family">WIC family ID</label>
                    <input
                        id="family"
                        v-model="form.familyId"
                        class="form-input"
                    />
                </div>
                <div class="form-field">
                    <label for="individual">WIC individual ID</label>
                    <input
                        id="individual"
                        v-model="form.individualId"
                        class="form-input"
                    />
                </div>
                <div class="form-field">
                    <label for="benefits-start">{{ requiredLabel('Benefits start date') }}</label>
                    <input
                        id="benefits-start"
                        v-model="form.benefitsStartDate"
                        class="form-input"
                        type="date"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="request-type">{{ requiredLabel('Request type') }}</label>
                    <select
                        id="request-type"
                        v-model="form.requestKind"
                        class="form-input"
                        required
                    >
                        <option value="new">New request</option>
                        <option value="extension">Extension</option>
                    </select>
                </div>
                <div class="form-field">
                    <label for="medical">Health Insurance</label>
                    <select
                        id="medical"
                        v-model="form.medicalStatus"
                        class="form-input"
                    >
                        <option value="pending">Pending</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
                </div>
            </div>
        </section>

        <section class="form-section">
            <div class="panel-heading">
                <div>
                    <h2>Medical Formula/Nutritionals and Qualifying Diagnosis</h2>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-field">
                    <label for="formula">{{ requiredLabel('Formula Name') }}</label>
                    <select
                        id="formula"
                        v-model="form.productId"
                        class="form-input"
                        required
                    >
                        <option value="">Select formula</option>
                        <option
                            v-for="product in products"
                            :key="product.id"
                            :value="String(product.id)"
                        >
                            {{ product.name }}
                        </option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div
                    v-if="form.productId === 'other'"
                    class="form-field"
                >
                    <label for="other-formula">{{ requiredLabel('Formula Name') }}</label>
                    <input
                        id="other-formula"
                        v-model="form.otherFormulaName"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="formula-form">{{ requiredLabel('Form') }}</label>
                    <select
                        id="formula-form"
                        v-model="form.productForm"
                        class="form-input"
                        required
                    >
                        <option value="powder">Powder</option>
                        <option value="concentrate">Concentrate</option>
                        <option value="ready-to-feed">Ready to feed</option>
                    </select>
                </div>
                <div
                    v-if="form.productForm === 'ready-to-feed'"
                    class="form-field full"
                >
                    <label for="rtf-justification">Why is ready to feed required?</label>
                    <textarea
                        id="rtf-justification"
                        v-model="form.readyToFeedJustification"
                        class="form-textarea"
                    />
                </div>
                <div class="form-field">
                    <label for="ounces">Amount Per Day (in ounces)</label>
                    <input
                        id="ounces"
                        v-model="form.ouncesPrescribed"
                        class="form-input"
                        type="number"
                        min="1"
                    />
                </div>
                <div class="form-field">
                    <label for="duration">Duration (in months)</label>
                    <input
                        id="duration"
                        v-model="form.durationMonths"
                        class="form-input"
                        type="number"
                        min="1"
                        max="6"
                    />
                </div>
                <div class="form-field full">
                    <label for="diagnosis">Qualifying Diagnosis</label>
                    <input
                        id="diagnosis"
                        v-model="form.diagnosis"
                        class="form-input"
                    />
                </div>
            </div>
        </section>

        <section class="form-section">
            <div class="panel-heading">
                <div>
                    <h2>Health Care Provider</h2>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-field">
                    <label for="doctor-name">{{ requiredLabel('Provider Name (printed)') }}</label>
                    <input
                        id="doctor-name"
                        v-model="form.doctorPrintedName"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field full checkbox-confirmation">
                    <label
                        class="checkbox-control"
                        for="doctor-signed-off"
                    >
                        <input
                            id="doctor-signed-off"
                            v-model="form.doctorHasSignedOff"
                            type="checkbox"
                            required
                        />
                        <span>{{ requiredLabel('Provider Signature') }}</span>
                    </label>
                </div>
                <div class="form-field">
                    <label for="prescription-signed-date">Date Signed</label>
                    <input
                        id="prescription-signed-date"
                        v-model="form.prescriptionSignedDate"
                        class="form-input"
                        type="date"
                    />
                </div>
                <div class="form-field full">
                    <label for="doctor-office">{{ requiredLabel('Medical Office/Clinic Name and Address') }}</label>
                    <input
                        id="doctor-office"
                        aria-label="Medical office/clinic name"
                        placeholder="Office/clinic name"
                        v-model="form.doctorOfficeName"
                        class="form-input"
                        required
                    />
                    <input
                        id="doctor-address"
                        aria-label="Medical office/clinic address"
                        placeholder="Office/clinic address"
                        v-model="form.doctorOfficeAddress"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field">
                    <label for="doctor-phone">{{ requiredLabel('Phone Number') }}</label>
                    <input
                        id="doctor-phone"
                        v-model="form.doctorOfficePhone"
                        class="form-input"
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        pattern="\(\d{3}\) \d{3}-\d{4}"
                        minlength="14"
                        maxlength="14"
                        @input="formatDoctorPhone"
                        required
                    />
                </div>
            </div>
        </section>

        <section class="form-section">
            <div class="panel-heading">
                <div>
                    <h2>Additional Information</h2>
                </div>
            </div>
            <textarea
                id="notes"
                v-model="form.additionalNotes"
                class="form-textarea"
            />
        </section>

        <div class="form-actions">
            <NuxtLink
                class="button button-ghost"
                to="/requests"
                >Cancel</NuxtLink
            >
            <button
                class="button button-primary"
                type="submit"
            >
                Submit request
            </button>
        </div>
        <p
            v-if="submitted"
            class="muted-copy"
        >
            Request saved. Returning to the request list…
        </p>
    </form>
</template>
