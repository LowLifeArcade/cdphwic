<script setup lang="ts">
import { formulaCatalog, findFormula, availableFormulaForms, defaultFormulaForm } from '~/../shared/formulaCatalog';
import type { ProductForm } from '~/../shared/domain';
import { addDiagnosis, validateAgencyFields } from '~/../shared/newRequestFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

const router = useRouter();
const fileInput = ref<HTMLInputElement>();
const submitted = ref(false);
const submissionError = ref('');
const diagnosisInput = ref('');
const diagnoses = computed(() => form.diagnosis.split('\n').map((value) => value.trim()).filter(Boolean));

function commitDiagnosis() {
    form.diagnosis = addDiagnosis(diagnoses.value, diagnosisInput.value).join('\n');
    diagnosisInput.value = '';
}

function removeDiagnosis(index: number) {
    form.diagnosis = diagnoses.value.filter((_, itemIndex) => itemIndex !== index).join('\n');
}
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
    formulaName: '',
    formulaFlavor: '',
    wicFoodRestrictions: '' as '' | 'under-6-months' | 'none' | 'restricted' | 'not-indicated',
    wicFoodRestrictionDetails: '',
    wicNutritionStaffNotes: '',
    wicNutritionStaffName: '',
    productForm: '' as ProductForm | '',
    readyToFeedJustification: '',
    medicalStatus: '',
    mediCalStatus: '',
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

const selectedFormula = computed(() => findFormula(form.formulaName));
const availableForms = computed(() => availableFormulaForms(form.formulaName));
const selectedProduct = computed(() => products.value.find((product) =>
    product.name.toLowerCase() === selectedFormula.value?.name.toLowerCase() && product.form === form.productForm,
));
const productName = computed(() => selectedFormula.value?.name ?? form.formulaName.trim());
watch(() => selectedFormula.value?.name, () => {
    form.productForm = defaultFormulaForm(form.formulaName);
}, { flush: 'sync' });

function agencyRequiredLabel(label: string) {
    return `${label} — Local agency required`;
}

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
                formulaName: string;
                wicFoodRestrictions: '' | 'under-6-months' | 'none' | 'restricted' | 'not-indicated';
                wicFoodRestrictionDetails: string;
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
            formulaName: result.extracted.formulaName || form.formulaName,
            doctorOfficePhone: formatPhoneNumber(result.extracted.doctorOfficePhone),
            medicalStatus: result.extracted.medicalStatus === 'pending' ? '' : result.extracted.medicalStatus,
        });
        if (!availableForms.value.includes(form.productForm as ProductForm)) {
            form.productForm = defaultFormulaForm(form.formulaName);
        }
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
    commitDiagnosis();
    submissionError.value = validateAgencyFields(form);
    if (!submissionError.value && (!selectedFormula.value || !availableForms.value.includes(form.productForm as ProductForm))) {
        submissionError.value = 'Select a matching formula name and an available form.';
    }
    if (submissionError.value) return;
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
            productId: selectedProduct.value?.id ?? -1,
            productName: productName.value,
            productForm: form.productForm,
            formulaFlavor: selectedFormula.value?.hasFlavor ? form.formulaFlavor.trim() : undefined,
            wicFoodRestrictions: form.wicFoodRestrictions || undefined,
            wicFoodRestrictionDetails: form.wicFoodRestrictions === 'restricted' ? form.wicFoodRestrictionDetails : '',
            wicNutritionStaffNotes: form.wicNutritionStaffNotes,
            wicNutritionStaffName: form.wicNutritionStaffName,
            medicalStatus: form.medicalStatus,
            mediCalStatus: form.medicalStatus === 'yes' ? form.mediCalStatus : undefined,
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
            <h1>New Request</h1>
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
                    <li>Qualifying medical diagnosis/condition(s)</li>
                    <li>Patient first name, last name, and date of birth</li>
                    <li>Formula name, form, amount in ounces per day, and duration in months</li>
                    <li>Provider printed name, signature, and date signed</li>
                    <li>Provider office name, address, and phone number</li>
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
                    <label for="medical">{{ agencyRequiredLabel('Health Insurance') }}</label>
                    <select
                        id="medical"
                        v-model="form.medicalStatus"
                        required
                        class="form-input"
                    >
                        <option disabled value="">Select health insurance</option>
                        <option value="yes">Medi-Cal</option>
                        <option value="no">Private Insurance</option>
                    </select>
                </div>
                <div v-if="form.medicalStatus === 'yes'" class="form-field">
                    <label for="medi-cal-status">{{ agencyRequiredLabel('Medi-Cal Status') }}</label>
                    <select id="medi-cal-status" v-model="form.mediCalStatus" class="form-input" required>
                        <option disabled value="">Select Medi-Cal status</option>
                        <option value="Denied">Denied</option>
                        <option value="Pending PA">Pending PA</option>
                        <option value="Product Not Covered">Product Not Covered</option>
                    </select>
                </div>
            </div>
            <fieldset class="form-field full local-agency-fields">
                <legend>Additional Participant Details</legend>
                <p>To be completed by the local agency. These fields are required to submit the request but are not part of complete medical documentation.</p>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="family">{{ agencyRequiredLabel('WIC Family ID') }}</label>
                        <input
                            id="family"
                            v-model="form.familyId"
                            required
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label for="individual">{{ agencyRequiredLabel('WIC Individual ID') }}</label>
                        <input
                            id="individual"
                            v-model="form.individualId"
                            required
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label for="benefits-start">{{ agencyRequiredLabel('Benefits Start Date') }}</label>
                        <input
                            id="benefits-start"
                            v-model="form.benefitsStartDate"
                            class="form-input"
                            type="date"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label for="request-type">{{ agencyRequiredLabel('Request Type') }}</label>
                        <select
                            id="request-type"
                            v-model="form.requestKind"
                            class="form-input"
                            required
                        >
                            <option value="new">New</option>
                            <option value="extension">Extension</option>
                        </select>
                    </div>
                </div>
            </fieldset>
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
                    <input
                        id="formula"
                        v-model="form.formulaName"
                        list="formula-matches"
                        class="form-input"
                        placeholder="Start typing a formula name"
                        autocomplete="off"
                        required
                    />
                    <datalist id="formula-matches">
                        <option v-for="formula in formulaCatalog" :key="formula.name" :value="formula.name" />
                    </datalist>
                </div>
                <div v-if="selectedFormula?.hasFlavor" class="form-field">
                    <label for="formula-flavor">Flavor</label>
                    <input id="formula-flavor" v-model="form.formulaFlavor" class="form-input" />
                </div>
                <div class="form-field">
                    <label for="formula-form">{{ requiredLabel('Form') }}</label>
                    <select
                        id="formula-form"
                        v-model="form.productForm"
                        class="form-input"
                        required
                    >
                        <option disabled value="">Select Form</option>
                        <option v-for="availableForm in availableForms" :key="availableForm" :value="availableForm">
                            {{ { powder: 'Powder', concentrate: 'Liquid Concentrate', 'ready-to-feed': 'Ready-to-Feed' }[availableForm] }}
                        </option>
                    </select>
                </div>
                <div
                    v-if="form.productForm === 'ready-to-feed'"
                    class="form-field full"
                >
                    <label for="rtf-justification">{{ requiredLabel('List reasons why ready-to-feed is needed.') }}</label>
                    <textarea
                        id="rtf-justification"
                        v-model="form.readyToFeedJustification"
                        required
                        class="form-textarea"
                    />
                </div>
                <div class="form-field">
                    <label for="ounces">{{ requiredLabel('Amount Per Day (in ounces)') }}</label>
                    <input
                        id="ounces"
                        v-model="form.ouncesPrescribed"
                        required
                        class="form-input"
                        type="text"
                        inputmode="decimal"
                        pattern="(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)"
                    />
                </div>
                <div class="form-field">
                    <label for="duration">{{ requiredLabel('Duration (in months)') }}</label>
                    <input
                        id="duration"
                        v-model="form.durationMonths"
                        required
                        class="form-input"
                        type="number"
                        min="1"
                        max="6"
                    />
                </div>
                <div class="form-field full">
                    <label for="diagnosis">{{ requiredLabel('Qualifying Diagnosis(es)') }}</label>
                    <input
                        id="diagnosis"
                        v-model="diagnosisInput"
                        :required="!diagnoses.length"
                        aria-required="true"
                        @keydown.enter.prevent="commitDiagnosis"
                        aria-describedby="diagnosis-help"
                        class="form-input"
                    />
                    <small id="diagnosis-help">Press Enter to add each diagnosis.</small>
                    <button type="button" class="text-button" :disabled="!diagnosisInput.trim()" @click="commitDiagnosis">Add diagnosis</button>
                    <ul v-if="diagnoses.length" aria-label="Added diagnoses" aria-live="polite">
                        <li v-for="(diagnosis, index) in diagnoses" :key="diagnosis">
                            {{ diagnosis }}
                            <button type="button" class="text-button" :aria-label="`Remove diagnosis: ${diagnosis}`" @click="removeDiagnosis(index)">Remove</button>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section class="form-section">
            <div class="panel-heading"><h2>WIC Food Restrictions</h2></div>
            <fieldset class="food-restriction-options" aria-label="WIC Food Restrictions">
                <label v-for="option in [
                    { value: 'under-6-months', label: 'Under 6 months' },
                    { value: 'none', label: 'No food restrictions (all WIC foods allowed)' },
                    { value: 'restricted', label: 'Food restrictions (see medical documentation)' },
                    { value: 'not-indicated', label: 'Neither box checked by HCP' },
                ]" :key="option.value" class="checkbox-control checkbox-confirmation">
                    <input
                        type="checkbox"
                        :checked="form.wicFoodRestrictions === option.value"
                        @change="form.wicFoodRestrictions = form.wicFoodRestrictions === option.value ? '' : option.value as typeof form.wicFoodRestrictions"
                    />
                    {{ option.label }}
                </label>
            </fieldset>
            <div class="form-grid">
                <div class="form-field full">
                    <label for="wic-staff-notes">WIC Nutrition Staff Notes</label>
                    <textarea id="wic-staff-notes" v-model="form.wicNutritionStaffNotes" class="form-textarea" />
                </div>
                <div class="form-field full compact-staff-name">
                    <label for="wic-staff-name">WIC Nutrition Staff Name</label>
                    <input id="wic-staff-name" v-model="form.wicNutritionStaffName" class="form-input" />
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
                <div class="form-field full">
                    <label for="doctor-name">{{ requiredLabel('Provider Name') }}</label>
                    <input
                        id="doctor-name"
                        v-model="form.doctorPrintedName"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field checkbox-confirmation compact-signature">
                    <label
                        class="checkbox-control"
                        for="doctor-signed-off"
                    >
                        <input
                            id="doctor-signed-off"
                            v-model="form.doctorHasSignedOff"
                            type="checkbox"
                            aria-required="true"
                        />
                        <span>{{ requiredLabel('Provider Signature') }}</span>
                    </label>
                </div>
                <div class="form-field">
                    <label for="prescription-signed-date">{{ requiredLabel('Date Signed') }}</label>
                    <input
                        id="prescription-signed-date"
                        v-model="form.prescriptionSignedDate"
                        required
                        class="form-input"
                        type="date"
                    />
                </div>
                <div class="form-field">
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
                <div class="form-field compact-provider-phone">
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
                    <span>Provide any additional details relevant to this request.</span>
                </div>
            </div>
            <textarea
                id="notes"
                v-model="form.additionalNotes"
                class="form-textarea"
            />
        </section>

        <p v-if="submissionError" role="alert">{{ submissionError }}</p>
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
                Submit
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
