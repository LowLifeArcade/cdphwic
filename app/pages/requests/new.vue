<script setup lang="ts">
import {canEditSubmission,restoreSubmittedForm} from '~/../shared/requestEditing';
import { benefitMonthLabels, toggleRequestedMonth, serializeRequestedMonths, validateRequestedMonths } from '~/../shared/requestMonthSelection';
import { formulaCatalog, findFormula, availableFormulaForms, defaultFormulaForm, requiresReadyToFeedReason } from '~/../shared/formulaCatalog';
import type { ProductForm, RequestRecord } from '~/../shared/domain';
import { blankFormula, formulaEntryName, getFormulaFieldErrors, validateOtherFormulaName, validateFormulaEntry, validateFormulaSelection, type FormulaEntry } from '~/../shared/formulaEntries';
import { diagnosisCatalog, findDiagnosis, validateDiagnoses } from '~/../shared/diagnosisCatalog';
import { addDiagnosis, validateAgencyFields, providerSignatureMessage } from '~/../shared/newRequestFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';

const router = useRouter();
const route = useRoute();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const draftId = ref<number | undefined>(route.query.draft ? Number(route.query.draft) : undefined);
const submissionId = ref<string>(crypto.randomUUID());
const editingId = ref<number|undefined>(route.query.request?Number(route.query.request):undefined);
const editingRevision=ref(0);
const editLocked=ref(false);
const existingAttachment=ref<RequestRecord['prescriptionAttachment']>();
const removeExistingAttachment=ref(false);
const saving = ref(false);
const draftSavedNotice = ref('');
const deleteConfirmationOpen=ref(false);
async function deleteUnsubmittedRequest(){
 if(saving.value || editingId.value) return;
 saving.value=true;
 try {
  if(draftId.value) await $fetch(`/api/requests/drafts/${draftId.value}`,{method:'DELETE',headers:{'x-demo-user':identity.value}});
  deleteConfirmationOpen.value=false;
  await router.push('/requests');
 } catch(error){
  submissionError.value=(error as {data?:{statusMessage?:string}}).data?.statusMessage??'The request could not be deleted. Please try again.';
  deleteConfirmationOpen.value=false;
 } finally {saving.value=false;}
}
const formulaAlert = ref('');
const additionalFormulas = ref<FormulaEntry[]>([]);
const surplusEntries = ref<Array<{ productName: string; productForm: ProductForm | ''; flavor: string; units: string | number; expirationDate: string }>>([]);
const requestedMonths = ref<string[]>([]);
const requestForm = ref<HTMLFormElement | null>(null);
const diagnosisDetailInput = ref<HTMLInputElement | null>(null);
const diagnosisDetails = ref('');
const formulaFocused = ref(false);
const formulaMatchIndex = ref(0);
const diagnosisMatchIndex = ref(0);
const diagnosisFocused = ref(false);
const fileInput = ref<HTMLInputElement>();
const submitted = ref(false);
const validationAttempted = ref(false);
const submissionError = ref('');
const diagnosisInput = ref('');
const diagnoses = computed(() => form.diagnosis.split(/[\n;]/).map((value) => value.trim()).filter(Boolean));

const pendingDiagnosis = computed(() => findDiagnosis(diagnosisInput.value));
const diagnosisMatches = computed(() => diagnosisInput.value.trim() && !pendingDiagnosis.value
    ? diagnosisCatalog.filter((item) => item.name.toLowerCase().includes(diagnosisInput.value.trim().toLowerCase())) : []);
function selectDiagnosis(name: string) {
    diagnosisInput.value = name;
    diagnosisDetails.value = '';
    diagnosisMatchIndex.value = 0;
    if (findDiagnosis(name)?.detail) nextTick(() => diagnosisDetailInput.value?.focus());
}
function commitDiagnosis() {
    const input = diagnosisInput.value.trim();
    if (!input) return true;
    const choice = findDiagnosis(input);
    if (choice?.detail && !diagnosisDetails.value.trim()) {
        submissionError.value = `Provide details for ${choice.name}.`;
        nextTick(() => diagnosisDetailInput.value?.focus());
        return false;
    }
    const entry = choice?.detail ? `${choice.name}: ${diagnosisDetails.value.trim()}` : choice?.name ?? input;
    form.diagnosis = addDiagnosis(diagnoses.value, entry).join('\n');
    diagnosisInput.value = '';
    diagnosisDetails.value = '';
    submissionError.value = '';
    return true;
}
function handleDiagnosisEnter() {
    const match = diagnosisMatches.value[diagnosisMatchIndex.value];
    if (diagnosisFocused.value && match) {
        selectDiagnosis(match.name);
        if (!match.detail) commitDiagnosis();
    }
    else commitDiagnosis();
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
    requestKind: '' as '' | 'new' | 'extension',
    formulaName: '',
    otherFormulaName: '',
    formulaFlavor: '',
    wicFoodRestrictions: '' as '' | 'under-6-months' | 'none' | 'restricted' | 'not-indicated',
    wicFoodRestrictionDetails: '',
    wicStaffFoodRestrictions: '' as '' | 'none' | 'restricted',
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

const isOtherFormula = computed(() => form.formulaName.trim().toLowerCase() === 'other');
const selectedFormula = computed(() => findFormula(form.formulaName));
const availableForms = computed(() => availableFormulaForms(form.formulaName));
const selectedProduct = computed(() => products.value.find((product) =>
    product.name.toLowerCase() === selectedFormula.value?.name.toLowerCase() && product.form === form.productForm,
));
const productName = computed(() => isOtherFormula.value ? form.otherFormulaName.trim() : selectedFormula.value?.name ?? form.formulaName.trim());
const formulaSelectionError = computed(() => validateFormulaSelection([form, ...additionalFormulas.value].map((entry) => ({ name: formulaEntryName(entry), form: entry.productForm, flavor: entry.formulaFlavor }))));
watch(formulaSelectionError, (error, previous) => { if (error && error !== previous) formulaAlert.value = error; });
function addAdditionalFormula() {
    if (!additionalFormulas.value.length) additionalFormulas.value.push(blankFormula());
}
function dismissFormulaAlert() {
    formulaAlert.value = '';
    nextTick(() => document.getElementById('extra-formula-2')?.focus());
}
const requestedFormulaNames = computed(() => [...new Set([productName.value, ...additionalFormulas.value.map(formulaEntryName)].filter(Boolean))]);
function surplusForms(name: string) {
    return findFormula(name) ? availableFormulaForms(name) : availableFormulaForms('Other');
}
function initializeSurplus(entry: typeof surplusEntries.value[number]) {
    const match = [form, ...additionalFormulas.value].find((formula) => formulaEntryName(formula) === entry.productName);
    entry.productForm = match?.productForm || defaultFormulaForm(entry.productName);
    entry.flavor = findFormula(entry.productName)?.hasFlavor ? match?.formulaFlavor ?? '' : '';
}
function addSurplus() {
    const entry: typeof surplusEntries.value[number] = { productName: requestedFormulaNames.value[0] ?? '', productForm: '', flavor: '', units: '', expirationDate: '' };
    initializeSurplus(entry);
    surplusEntries.value.push(entry);
}
function selectedBenefitMonths() {
    return serializeRequestedMonths(requestedMonths.value, form.benefitsStartDate, new Date().getFullYear());
}
function serializedFormulas() {
    return [form, ...additionalFormulas.value].map((entry) => ({
        productName: formulaEntryName(entry), productForm: entry.productForm as ProductForm,
        ouncesPrescribed: Number(entry.ouncesPrescribed), flavor: entry.formulaFlavor,
        otherFormulaName: entry.formulaName.trim().toLowerCase() === 'other' ? entry.otherFormulaName.trim() : undefined,
        readyToFeedJustification: requiresReadyToFeedReason(entry.formulaName, entry.productForm) ? entry.readyToFeedJustification : '',
    }));
}
watch(() => isOtherFormula.value ? 'Other' : selectedFormula.value?.name, () => {
    form.productForm = defaultFormulaForm(form.formulaName);
}, { flush: 'sync' });

const formulaMatches = computed(() => {
    const query = form.formulaName.trim().toLowerCase();
    return query.length >= 3 && !selectedFormula.value && !isOtherFormula.value
        ? [...formulaCatalog.filter((item) => item.name.toLowerCase().includes(query)), { name: 'Other' }] : [];
});
function selectFormula(name: string) {
    form.formulaName = name;
    formulaMatchIndex.value = 0;
}
watch(() => form.formulaName, () => { formulaMatchIndex.value = 0; });
watch(diagnosisInput, () => { diagnosisMatchIndex.value = 0; });

if (draftId.value) {
    const {data: draftData, error: draftError} = await useFetch<{ form: Record<string, string | number | boolean>; prescriptionKey: string; fileName: string }>(`/api/requests/drafts/${draftId.value}`, {
        headers: { 'x-demo-user': identity.value },
    });
    if (draftError.value) throw createError(draftError.value);
    const draft = draftData.value;
    if (!draft) throw createError({statusCode:404,statusMessage:'Incomplete request not found.'});
    const { _submissionId, _diagnosisInput, _diagnosisDetails, _additionalFormulas, _surplusEntries, _requestedMonths, ...values } = draft.form;
    Object.assign(form, values);
    if (_submissionId) submissionId.value = String(_submissionId);
    additionalFormulas.value = _additionalFormulas ? JSON.parse(String(_additionalFormulas)) : [];
    surplusEntries.value = _surplusEntries ? JSON.parse(String(_surplusEntries)) : [];
    for (const entry of surplusEntries.value) if (!entry.productForm) initializeSurplus(entry);
    requestedMonths.value = _requestedMonths ? JSON.parse(String(_requestedMonths)) : [];
    diagnosisInput.value = String(_diagnosisInput ?? '');
    diagnosisDetails.value = String(_diagnosisDetails ?? '');
    uploadedStorageKey.value = draft.prescriptionKey;
    if (draft.fileName) selectedPrescription.value = new File([], draft.fileName);
}

if(editingId.value){
 const {data: editingData,error: editingError}=await useFetch<{request:RequestRecord}>(`/api/requests/${editingId.value}`,{headers:{'x-demo-user':identity.value}});
 if(editingError.value) throw createError(editingError.value);
 if(!editingData.value) throw createError({statusCode:404,statusMessage:'Request not found.'});
 let request=editingData.value.request;
 if(identity.value!=='agency' && canEditSubmission(request)){
  const result=await $fetch<{request:RequestRecord}>(`/api/requests/${editingId.value}`,{method:'PUT',body:{status:'opened'},headers:{'x-demo-user':identity.value}});
  request=result.request;
 }
 const restored=restoreSubmittedForm(request);
 Object.assign(form,restored.form);
 additionalFormulas.value=restored.additionalFormulas;
 surplusEntries.value=restored.surplusEntries;
 requestedMonths.value=restored.requestedMonths;
 editingRevision.value=request.revision??0;
 submissionId.value=request.submissionId??`legacy-${request.id}`;
 editLocked.value=identity.value!=='agency'||!canEditSubmission(request);
 existingAttachment.value=request.prescriptionAttachment;
 if(request.prescriptionAttachment)selectedPrescription.value=new File([],request.prescriptionAttachment.fileName);
}

async function saveRequest() {
    if (saving.value || parsing.value) return;
    draftSavedNotice.value = '';
    saving.value = true;
    submissionError.value = '';
    try {
        const result = await $fetch<{ request: RequestRecord }>('/api/requests/drafts', {
            method: 'POST', headers: { 'x-demo-user': identity.value },
            body: {
                id: draftId.value,
                form: { ...form, _submissionId: submissionId.value, _diagnosisInput: diagnosisInput.value, _diagnosisDetails: diagnosisDetails.value, _additionalFormulas: JSON.stringify(additionalFormulas.value), _surplusEntries: JSON.stringify(surplusEntries.value), _requestedMonths: JSON.stringify(requestedMonths.value) },
                prescriptionKey: uploadedStorageKey.value,
                fileName: selectedPrescription.value?.name ?? '',
            },
        });
        draftId.value = result.request.id;
        await router.replace({path:route.path,query:{...route.query,draft:String(result.request.id)}});
        draftSavedNotice.value = 'Information saved.';
    } catch (error) {
        submissionError.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'The incomplete request could not be saved. Please try again.';
    } finally {
        saving.value = false;
    }
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
                formulas: FormulaEntry[];
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
        const { formulas: parsedFormulas, ...parsedFields } = result.extracted;
        Object.assign(form, {
            ...parsedFields,
            formulaName: result.extracted.formulaName || form.formulaName,
            doctorOfficePhone: formatPhoneNumber(result.extracted.doctorOfficePhone),
            medicalStatus: result.extracted.medicalStatus === 'pending' ? '' : result.extracted.medicalStatus,
        });
        if (parsedFormulas?.length) {
            Object.assign(form, parsedFormulas[0]);
            additionalFormulas.value = parsedFormulas.slice(1, 2);
            if (parsedFormulas.length > 2) {
                formulaAlert.value = `Only up to 2 formulas are allowed. The PDF also lists: ${parsedFormulas.slice(2).map(formulaEntryName).join(', ')}. Review the uploaded documentation and use a separate request for additional formulas.`;
            }
        }
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
            await $fetch('/api/requests/prescription-upload/remove', {
                method: 'POST',
                body: { key: uploadedStorageKey.value },
            });
        }
        if (existingAttachment.value) removeExistingAttachment.value=true;
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

function syncFieldValidity() {
    // Read reactive values before accessing the DOM so dynamically added fields are revalidated.
    const entries = [{...form}, ...additionalFormulas.value.map(entry => ({...entry}))];
    const diagnosisError = validateDiagnoses(form.diagnosis);
    const duplicateError = formulaSelectionError.value;
    const attempted = validationAttempted.value;
    const root = requestForm.value;
    if (!root) return;
    const controls = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')];
    for (const control of controls) {
        control.setCustomValidity('');
        if (control.required && control.type !== 'checkbox' && !control.value.trim()) control.setCustomValidity('Complete this field.');
    }
    const setError = (id: string, message: string) => {
        const control = controls.find(item => item.id === id);
        if (control && message) control.setCustomValidity(message);
    };
    entries.forEach((entry, index) => {
        const ids = index === 0
            ? {formulaName:'formula',otherFormulaName:'other-formula-name',productForm:'formula-form',ouncesPrescribed:'ounces',readyToFeedJustification:'rtf-justification'}
            : {formulaName:`extra-formula-${index+1}`,otherFormulaName:`extra-formula-${index+1}-other`,productForm:`extra-formula-${index+1}-form`,ouncesPrescribed:`extra-formula-${index+1}-amount`,readyToFeedJustification:`extra-formula-${index+1}-reason`};
        for (const [key, message] of Object.entries(getFormulaFieldErrors(entry))) setError(ids[key as keyof typeof ids], message!);
    });
    if (!form.doctorHasSignedOff) setError('doctor-signed-off', providerSignatureMessage);
    if (duplicateError) setError('extra-formula-2', duplicateError);
    if (diagnosisError && (!diagnosisInput.value.trim() || form.diagnosis.trim())) setError('diagnosis', diagnosisError);
    if (form.doctorOfficePhone.trim() && !normalizePhoneNumber(form.doctorOfficePhone)) setError('doctor-phone', 'Enter a valid Phone Number.');
    for (const control of controls) {
        if (attempted && !control.validity.valid) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
    }
}
watch([form, additionalFormulas, surplusEntries, diagnosisInput, diagnosisDetails, requestForm, validationAttempted], syncFieldValidity, {deep:true, flush:'post', immediate:true});

async function submitRequest() {
    submitted.value = false;
    if (saving.value || parsing.value) return;
    validationAttempted.value = true;
    const diagnosisCommitted = commitDiagnosis();
    await nextTick();
    syncFieldValidity();
    const invalid = requestForm.value?.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid, [data-required-group][aria-invalid="true"]');
    if (invalid || !diagnosisCommitted) {
        submissionError.value = 'Complete the fields highlighted in red before submitting. You can still Save an incomplete request.';
        invalid?.focus();
        if (invalid && 'reportValidity' in invalid) (invalid as HTMLInputElement).reportValidity();
        return;
    }
    submissionError.value = formulaSelectionError.value || validateAgencyFields(form);
    if (!submissionError.value && ((!selectedFormula.value && !isOtherFormula.value) || (isOtherFormula.value && (!form.otherFormulaName.trim() || form.otherFormulaName.trim().toLowerCase() === 'other')) || !availableForms.value.includes(form.productForm as ProductForm))) {
        submissionError.value = 'Select a matching formula name and an available form.';
    }
    if (!submissionError.value) {
        for (const [index, entry] of additionalFormulas.value.entries()) {
            const error = validateFormulaEntry(entry);
            if (error) { submissionError.value = `Formula ${index + 2}: ${error}`; break; }
        }
    }
    if (!submissionError.value && surplusEntries.value.some((entry) => !requestedFormulaNames.value.includes(entry.productName) || !Number.isFinite(Number(entry.units)) || Number(entry.units) <= 0)) {
        submissionError.value = 'Select a requested formula and enter a positive surplus quantity.';
    }
    if (!submissionError.value) submissionError.value = validateRequestedMonths(selectedBenefitMonths());
    if (!submissionError.value && surplusEntries.value.some((entry) => !entry.productForm || !surplusForms(entry.productName).includes(entry.productForm))) submissionError.value = 'Select a valid Form for each surplus entry.';
    if (submissionError.value) return;
    saving.value = true;
    try {
        const participantName = `${form.patientFirstName} ${form.patientLastName}`.trim();
        const body = new FormData();
        body.append(
            'request',
            JSON.stringify({
                draftId: draftId.value,
                revision: editingRevision.value,
                removePrescriptionAttachment: removeExistingAttachment.value,
                submissionId: submissionId.value,
                agencyId: 10,
                agencyMemberId: 100,
                participantName,
                participantFirstName: form.patientFirstName,
                participantLastName: form.patientLastName,
                participantDob: form.participantDob,
                participantFamilyId: Number(form.familyId) || undefined,
                wicIndividualId: form.individualId || undefined,
                benefitsStartDate: form.benefitsStartDate,
                benefitMonthsRequested: selectedBenefitMonths(),
                requestKind: form.requestKind,
                productId: selectedProduct.value?.id ?? -1,
                productName: productName.value,
                requestedFormulas: serializedFormulas(),
                surplusItems: surplusEntries.value.map((entry) => ({ ...entry, units: Number(entry.units) })),
                productForm: form.productForm,
                formulaFlavor: selectedFormula.value?.hasFlavor ? form.formulaFlavor.trim() : undefined,
                wicFoodRestrictions: form.wicFoodRestrictions || undefined,
                wicFoodRestrictionDetails: form.wicFoodRestrictions === 'restricted' ? form.wicFoodRestrictionDetails : '',
                wicStaffFoodRestrictions: form.wicFoodRestrictions === 'not-indicated' ? form.wicStaffFoodRestrictions || undefined : undefined,
                wicNutritionStaffNotes: form.wicFoodRestrictions === 'not-indicated' && form.wicStaffFoodRestrictions === 'restricted' ? form.wicNutritionStaffNotes : '',
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
                    otherFormulaName: isOtherFormula.value ? form.otherFormulaName.trim() : '',
                    readyToFeedJustification: form.readyToFeedJustification,
                    additionalNotes: form.additionalNotes,
                },
            }),
        );
        await $fetch(editingId.value?`/api/requests/${editingId.value}/submission`:'/api/requests', { method: editingId.value?'PUT':'POST', body, headers: { 'x-demo-user': identity.value } });
        submitted.value = true;
        await router.push('/requests');
    } catch (error) {
        submissionError.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'The request could not be submitted. Your entries are still available to save.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Requests</p>
            <h1>{{editingId?'Edit Request':'New Request'}}</h1>
            <p v-if="editingId&&!editLocked">You can update this submission until Admin or FPU opens it.</p>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/requests"
            >Cancel</NuxtLink
        >
    </div>
    <p v-if="editLocked" role="alert">Admin/FPU has opened this submission. Its submitted form can no longer be edited.</p>
    <form v-else
        ref="requestForm"
        class="panel form-panel request-form"
        :class="{'validation-attempted': validationAttempted}"
        novalidate
        @submit.prevent="submitRequest"
    >
        <section class="form-section prescription-first">
            <div class="panel-heading">
                <div>
                    <h2>Medical Documentation</h2>
                </div>
            </div>
            <div class="prescription-requirements">
                <strong>Before uploading, check that medical documentation includes ALL of the following:</strong>
                <ul>
                    <li>Patient first name and last name</li>
                    <li>Prescribed formula name, form, amount in ounces per day, and duration in months (if RTF form is selected, must include justification)</li>
                    <li>Qualifying medical diagnosis(es)/condition(s)</li>
                    <li>WIC food restrictions, if applicable</li>
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
                    <strong>Drag and drop medical documentation here</strong>
                    <span>Choose a PDF or photo.<br />PDFs populate matching form fields; photos require manual entry.</span>
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
                    Remove <strong>{{ selectedPrescription.name }}</strong>? Changes to a submitted attachment take effect when you save. Temporary uploads are removed from storage.
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
            <div class="form-grid participant-grid">
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
                    <label for="dob">Date of Birth</label>
                    <input
                        id="dob"
                        v-model="form.participantDob"
                        class="form-input"
                        type="date"
                        required
                    />
                </div>
                <div class="insurance-fields">
                <div class="form-field">
                    <label for="medical">Health Insurance</label>
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
                    <label for="medi-cal-status">Medi-Cal Status</label>
                    <select id="medi-cal-status" v-model="form.mediCalStatus" class="form-input" required>
                        <option disabled value="">Select Medi-Cal status</option>
                        <option value="Denied">Denied</option>
                        <option value="Pending PA">Pending PA</option>
                        <option value="Product Not Covered">Product Not Covered</option>
                    </select>
                </div>
            </div>
            </div>
            <fieldset class="form-field full local-agency-fields">
                <legend>Additional Participant Details</legend>
                <p>To be provided by the local agency. These fields are needed to submit the request but not part of complete medical documentation.</p>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="family">WIC Family ID</label>
                        <input
                            id="family"
                            v-model="form.familyId"
                            required
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label for="individual">WIC Individual ID</label>
                        <input
                            id="individual"
                            v-model="form.individualId"
                            required
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label for="benefits-start">Benefits Start Date</label>
                        <input
                            id="benefits-start"
                            v-model="form.benefitsStartDate"
                            class="form-input"
                            type="date"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label for="request-type">Request Type</label>
                        <select
                            id="request-type"
                            v-model="form.requestKind"
                            class="form-input"
                            required
                        >
                            <option disabled value="">Select New or Extension</option>
                            <option value="new">New</option>
                            <option value="extension">Extension</option>
                        </select>
                    </div>
                </div>
                <fieldset class="benefit-month-picker">
                    <legend>Benefit Month(s) Requested</legend>
                    <small>Select up to 3 months.</small>
                    <div class="benefit-month-options">
                        <label v-for="(month, index) in benefitMonthLabels" :key="month" class="benefit-month-option" :class="{ 'month-selected': requestedMonths.includes(String(index + 1).padStart(2, '0')) }">
                            <input type="checkbox" :checked="requestedMonths.includes(String(index + 1).padStart(2, '0'))"
                                :disabled="requestedMonths.length >= 3 && !requestedMonths.includes(String(index + 1).padStart(2, '0'))"
                                @change="requestedMonths = toggleRequestedMonth(requestedMonths, String(index + 1).padStart(2, '0'))" />
                            {{ month }}
                        </label>
                    </div>
                </fieldset>
            </fieldset>
        </section>

        <section class="form-section">
            <div class="panel-heading">
                <div>
                    <h2>Medical Formula/Nutritionals and Qualifying Diagnosis</h2>
                </div>
            </div>
            <div class="form-grid">
                <fieldset class="formula-group full">
                    <legend>Formula 1</legend>
                    <div class="form-grid formula-entry-grid" :class="{'has-formula-details': isOtherFormula || selectedFormula?.hasFlavor, 'has-other-formula': isOtherFormula}">
                        <div class="form-field formula-name-field">
                            <label for="formula">{{ requiredLabel('Formula Name') }}</label>
                            <div class="formula-autocomplete">
                                <input
                                    id="formula"
                                    v-model="form.formulaName"
                                    @focus="formulaFocused = true"
                                    @input="formulaFocused = true"
                                    @keydown.esc.prevent="formulaFocused = false"
                                    role="combobox"
                                    aria-autocomplete="list"
                                    aria-controls="formula-matches"
                                    :aria-expanded="formulaFocused && formulaMatches.length > 0"
                                    :aria-activedescendant="formulaFocused && formulaMatches.length ? `formula-match-${formulaMatchIndex}` : undefined"
                                    @blur="formulaFocused = false"
                                    @keydown.down.prevent="formulaMatchIndex = Math.min(formulaMatchIndex + 1, formulaMatches.length - 1)"
                                    @keydown.up.prevent="formulaMatchIndex = Math.max(formulaMatchIndex - 1, 0)"
                                    @keydown.enter.prevent="formulaMatches[formulaMatchIndex] && selectFormula(formulaMatches[formulaMatchIndex]!.name)"
                                    class="form-input"
                                    placeholder="Start typing a formula name or type Other"
                                    autocomplete="off"
                                    required
                                />
                                <div v-if="formulaFocused && formulaMatches.length" id="formula-matches" class="form-suggestions formula-dropdown" role="listbox" aria-label="Matching formulas">
                                    <button v-for="(formula, index) in formulaMatches" :key="formula.name" type="button" role="option" tabindex="-1"
                                        :id="`formula-match-${index}`" :aria-selected="index === formulaMatchIndex"
                                        :class="{ 'suggestion-active': index === formulaMatchIndex }"
                                        @pointerdown.prevent @click="selectFormula(formula.name)">{{ formula.name }}</button>
                                </div>
                            </div>
                        </div>
                        <div v-if="isOtherFormula" class="form-field formula-detail-field">
                            <label for="other-formula-name">{{ requiredLabel('Other Formula Name') }}</label>
                            <input id="other-formula-name" v-model="form.otherFormulaName" class="form-input" required aria-describedby="other-formula-error" />
                            <small v-if="form.otherFormulaName.trim() && validateOtherFormulaName(form.otherFormulaName)" id="other-formula-error" class="field-error" role="alert">{{ validateOtherFormulaName(form.otherFormulaName) }}</small>
                        </div>
                        <div v-if="selectedFormula?.hasFlavor" class="form-field formula-detail-field">
                            <label for="formula-flavor">Flavor</label>
                            <input id="formula-flavor" v-model="form.formulaFlavor" class="form-input" />
                        </div>
                        <div class="form-field formula-form-field">
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
                        <div class="form-field formula-amount-field">
                            <label for="ounces">Amount (in ounces per day)</label>
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
                        <div
                            v-if="requiresReadyToFeedReason(form.formulaName, form.productForm)"
                            class="form-field formula-justification-field"
                        >
                            <label for="rtf-justification">{{ requiredLabel('Justification') }}</label>
                            <textarea
                                id="rtf-justification"
                                v-model="form.readyToFeedJustification"
                                placeholder='List reason(s) why ready-to-feed is needed. Otherwise, type "Only form available"'
                                required
                                rows="1"
                                class="form-textarea rtf-reason"
                            />
                        </div>
                    </div>
                </fieldset>
                <fieldset v-for="(_, index) in additionalFormulas" :key="index" class="additional-formula formula-group full">
                    <legend>Formula {{ index + 2 }}</legend>
                    <AdditionalFormulaFields v-model="additionalFormulas[index]!" :index="index + 2" />
                    <p v-if="formulaSelectionError" class="field-error" role="alert">{{ formulaSelectionError }}</p>
                    <button class="text-button" type="button" @click="additionalFormulas.splice(index, 1)">Remove formula {{ index + 2 }}</button>
                </fieldset>
                <div v-if="!additionalFormulas.length" class="form-field full add-formula-action">
                    <button class="button button-ghost add-formula-button" type="button" @click="addAdditionalFormula">Add another formula</button>
                </div>
                <div class="form-field">
                    <label for="duration">{{ requiredLabel('Duration (in months)') }}</label>
                    <select
                        id="duration"
                        v-model="form.durationMonths"
                        required
                        class="form-input"
                    >
                        <option v-for="month in 6" :key="month" :value="String(month)">{{ month }}</option>
                    </select>
                </div>
                <div class="form-field full">
                    <label for="diagnosis">{{ requiredLabel('Qualifying Diagnosis(es)') }}</label>
                    <input
                        id="diagnosis"
                        v-model="diagnosisInput"
                        placeholder="Start typing a diagnosis and press Enter to add each diagnosis."
                        :required="!diagnoses.length"
                        aria-required="true"
                        @focus="diagnosisFocused = true"
                        @blur="diagnosisFocused = false"
                        @keydown.down.prevent="diagnosisMatchIndex = Math.min(diagnosisMatchIndex + 1, diagnosisMatches.length - 1)"
                        @keydown.up.prevent="diagnosisMatchIndex = Math.max(diagnosisMatchIndex - 1, 0)"
                        @keydown.enter.prevent="handleDiagnosisEnter"
                        aria-describedby="diagnosis-help"
                        class="form-input"
                    />
                    <small id="diagnosis-help">Press Enter to add each diagnosis.</small>
                    <div v-if="diagnosisFocused && diagnosisMatches.length" class="form-suggestions" aria-label="Matching diagnoses">
                        <button v-for="(choice, index) in diagnosisMatches" :key="choice.name" type="button"
                            :class="{ 'suggestion-active': index === diagnosisMatchIndex }"
                            @pointerdown.prevent @click="selectDiagnosis(choice.name)">{{ choice.name }}</button>
                    </div>
                    <div v-if="pendingDiagnosis?.detail" class="form-field">
                        <label for="diagnosis-details">{{ requiredLabel(`Details for ${pendingDiagnosis.name}`) }}</label>
                        <input id="diagnosis-details" ref="diagnosisDetailInput" v-model="diagnosisDetails" class="form-input" required @keydown.enter.prevent="commitDiagnosis" />
                        <small>Specify the condition or nutrient, then press Enter to add this diagnosis.</small>
                    </div>
                    <ul v-if="diagnoses.length" class="diagnosis-list" aria-label="Added diagnoses" aria-live="polite">
                        <li v-for="(diagnosis, index) in diagnoses" :key="diagnosis">
                            <span>{{ diagnosis }}</span>
                            <button type="button" class="text-button" :aria-label="`Remove diagnosis: ${diagnosis}`" @click="removeDiagnosis(index)">Remove</button>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section class="form-section">
            <div class="panel-heading"><h2>{{ requiredLabel('WIC Food Restrictions') }}</h2></div>
            <fieldset class="food-restriction-options" aria-label="WIC Food Restrictions" data-required-group tabindex="-1" :aria-invalid="validationAttempted && !form.wicFoodRestrictions">
                <label v-for="option in [
                    { value: 'under-6-months', label: 'Participant is under 6 months' },
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
            <fieldset v-if="form.wicFoodRestrictions === 'not-indicated'" class="local-agency-fields staff-food-review">
                <legend>Local Agency WIC Nutrition Staff Review</legend>
                <p>A WIC Nutrition Staff member must complete this section.</p>
                <div class="food-restriction-options" role="group" aria-label="WIC Nutrition Staff food restrictions" data-required-group tabindex="-1" :aria-invalid="validationAttempted && !form.wicStaffFoodRestrictions">
                    <label v-for="option in [
                        { value: 'none', label: 'No food restrictions (all WIC foods allowed)' },
                        { value: 'restricted', label: 'Food restrictions (listed below)' },
                    ]" :key="option.value" class="checkbox-control checkbox-confirmation">
                        <input type="checkbox" :checked="form.wicStaffFoodRestrictions === option.value"
                            @change="form.wicStaffFoodRestrictions = form.wicStaffFoodRestrictions === option.value ? '' : option.value as 'none' | 'restricted'" />
                        {{ option.label }}
                    </label>
                </div>
                <div class="form-grid">
                    <div v-if="form.wicStaffFoodRestrictions === 'restricted'" class="form-field full">
                        <label for="wic-staff-notes">{{ requiredLabel('WIC Nutrition Staff Notes') }}</label>
                        <textarea id="wic-staff-notes" v-model="form.wicNutritionStaffNotes" class="form-textarea" required />
                    </div>
                    <div class="form-field full compact-staff-name">
                        <label for="wic-staff-name">{{ requiredLabel('WIC Nutrition Staff Name') }}</label>
                        <input id="wic-staff-name" v-model="form.wicNutritionStaffName" class="form-input" required />
                    </div>
                </div>
            </fieldset>
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
                            required
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
                    <textarea
                        id="doctor-address"
                        aria-label="Medical office/clinic address"
                        placeholder="Street address&#10;City, State ZIP"
                        v-model="form.doctorOfficeAddress"
                        class="form-textarea office-address"
                        rows="3"
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
            <div class="panel-heading"><h2>Surplus Formula</h2></div>
            <p>Enter any surplus the local agency has of the formula(s) requested.</p>
            <div v-for="(entry, index) in surplusEntries" :key="index" class="form-grid surplus-form-row">
                <div class="form-field">
                    <label :for="`surplus-formula-${index}`">Formula Name</label>
                    <select :id="`surplus-formula-${index}`" v-model="entry.productName" class="form-input" required @change="initializeSurplus(entry)">
                        <option disabled value="">Select requested formula</option>
                        <option v-for="name in requestedFormulaNames" :key="name" :value="name">{{ name }}</option>
                    </select>
                </div>
                <div class="form-field">
                    <label :for="`surplus-form-${index}`">Form</label>
                    <select :id="`surplus-form-${index}`" v-model="entry.productForm" class="form-input" required>
                        <option disabled value="">Select Form</option>
                        <option v-for="option in surplusForms(entry.productName)" :key="option" :value="option">{{ { powder: 'Powder', concentrate: 'Liquid Concentrate', 'ready-to-feed': 'Ready-to-Feed' }[option] }}</option>
                    </select>
                </div>
                <div v-if="findFormula(entry.productName)?.hasFlavor" class="form-field">
                    <label :for="`surplus-flavor-${index}`">Flavor</label>
                    <input :id="`surplus-flavor-${index}`" v-model="entry.flavor" class="form-input" />
                </div>
                <div class="form-field">
                    <label :for="`surplus-units-${index}`">Surplus Quantity (in units)</label>
                    <input :id="`surplus-units-${index}`" v-model="entry.units" class="form-input" type="number" min="1" required />
                </div>
                <div class="form-field">
                    <label :for="`surplus-expiration-${index}`">Expiration Date</label>
                    <input :id="`surplus-expiration-${index}`" v-model="entry.expirationDate" class="form-input" type="date" />
                </div>
                <button type="button" class="text-button" @click="surplusEntries.splice(index, 1)">Remove surplus entry</button>
            </div>
            <button class="button button-ghost add-surplus-button" type="button" @click="addSurplus">Add surplus</button>
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
                aria-label="Additional Information"
                placeholder="Provide any additional details relevant to this request."
                class="form-textarea"
            />
        </section>

        <div v-if="formulaAlert" class="confirmation-backdrop" role="presentation" @click.self="dismissFormulaAlert">
            <section class="confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="formula-alert-title" aria-describedby="formula-alert-message">
                <h2 id="formula-alert-title">Error - Duplicate Formula</h2>
                <p id="formula-alert-message">{{ formulaAlert }}</p>
                <div class="formula-alert-actions">
                    <button class="button button-primary" type="button" @click="dismissFormulaAlert">OK</button>
                </div>
            </section>
        </div>
        <div v-if="deleteConfirmationOpen" class="confirmation-backdrop" role="presentation" @click.self="!saving && (deleteConfirmationOpen=false)">
            <section class="confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-request-title" @keydown.esc="!saving && (deleteConfirmationOpen=false)">
                <h2 id="delete-request-title">Are you sure you want to delete this?</h2>
                <div class="form-actions">
                    <button class="button button-ghost" type="button" :disabled="saving" @click="deleteConfirmationOpen=false">Cancel</button>
                    <button class="button button-danger" type="button" :disabled="saving" @click="deleteUnsubmittedRequest">{{saving?'Deleting…':'Delete'}}</button>
                </div>
            </section>
        </div>
        <p v-if="draftSavedNotice" class="save-feedback save-feedback-saved" role="status" aria-live="polite">{{ draftSavedNotice }}</p>
        <p v-if="submissionError" class="submission-alert" role="alert">{{ submissionError }}</p>
        <div class="form-actions">
            <NuxtLink
                class="button button-ghost"
                to="/requests"
                >Cancel</NuxtLink
            >
            <button v-if="!editingId" class="button button-ghost" type="button" :disabled="saving || parsing" @click="saveRequest">Save</button>
            <button v-if="!editingId" class="button button-ghost" type="button" :disabled="saving || parsing" @click="router.push('/requests')">Close</button>
            <button v-if="!editingId" class="button button-danger" type="button" :disabled="saving || parsing" @click="deleteConfirmationOpen=true">Delete</button>
            <button
                class="button button-primary"
                type="submit"
                :disabled="saving || parsing"
            >
                {{ saving ? 'Saving…' : editingId?'Save Changes':'Submit' }}
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

<style scoped>
.participant-grid {align-items:start;}
.insurance-fields {display:grid;gap:16px;align-content:start;}
</style>
