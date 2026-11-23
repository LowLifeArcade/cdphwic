<script setup lang="ts">
import { restoreRequestDraft, serializeRequestDraft } from '~/features/requests/requestDraft';
import RequestProviderFields from '~/features/requests/components/RequestProviderFields.vue';
import RequestFoodRestrictionFields from '~/features/requests/components/RequestFoodRestrictionFields.vue';
import RequestParticipantFields from '~/features/requests/components/RequestParticipantFields.vue';
import { toRef } from 'vue';
import { validateDiagnoses } from '~/../shared/diagnosisCatalog';
import { usePrescriptionUpload, type PrescriptionParseResult } from '~/features/requests/composables/usePrescriptionUpload';
import { requestSubmissionBody } from '~/features/requests/requestSubmissionBody';
import { blankRequestForm } from '~/features/requests/requestForm';
import { useRequestDiagnoses } from '~/features/requests/composables/useRequestDiagnoses';
import {unitLabel} from '~/../shared/quantityLabels';
import {validateBreastfeeding} from '~/../shared/breastfeeding';
import { hasMedicalDocumentation, medicalDocumentationRequiredMessage } from '~/../shared/medicalDocumentation';
import {shippingContact,blankClinicAddress,validateShipping,type RequestShipping,type ClinicRecord} from '~/../shared/shipping';
import {canEditSubmission,hasPendingMoreInfo,restoreSubmittedForm} from '~/../shared/requestEditing';
import { benefitMonthLabels, toggleRequestedMonth, serializeRequestedMonths, validateRequestedMonths } from '~/../shared/requestMonthSelection';
import { catalogFormulaOptions, findFormula, availableFormulaForms, defaultFormulaForm, requiresReadyToFeedReason } from '~/../shared/formulaCatalog';
import { resolveProduct } from '~/../shared/productMatching';
import type { ProductForm, RequestRecord } from '~/../shared/domain';
import { blankFormula, formulaEntryName, getFormulaFieldErrors, validateOtherFormulaName, validateFormulaEntry, validateFormulaSelection, type FormulaEntry } from '~/../shared/formulaEntries';
import { validateAgencyFields, providerSignatureMessage } from '~/../shared/newRequestFields';
import { formatPhoneNumber, normalizePhoneNumber } from '~/../shared/phone';
import {availableUnits,normalizeVariantText} from '~/../shared/surplus';

const router = useRouter();
const route = useRoute();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const draftId = ref<number | undefined>(route.query.draft ? Number(route.query.draft) : undefined);
const submissionId = ref<string>(crypto.randomUUID());
const editingId = ref<number|undefined>(route.query.request?Number(route.query.request):undefined);
const editingRevision=ref(0);
const editLocked=ref(false);
const correctingRequest=ref(false);
const correctionNotes=ref('');
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
const surplusEntries = ref<Array<{ productName: string; productForm: ProductForm | ''; flavor: string; units: string | number; expirationDate: string; clinicId?: string }>>([]);
const requestedMonths = ref<string[]>([]);
const requestForm = ref<HTMLFormElement | null>(null);
const formulaFocused = ref(false);
const formulaMatchIndex = ref(0);
const submitted = ref(false);
const validationAttempted = ref(false);
const submissionError = ref('');
const { data: productData } = await useFetch('/api/products');
const products = computed(() => productData.value?.products ?? []);
const {data:agencyOptions}=await useFetch('/api/agencies');
const {data:shippingProfile}=await useFetch('/api/profile',{headers:computed(()=>({'x-demo-user':identity.value}))});
const requestAgencyId=ref(shippingProfile.value?.user?.agencyId??10);
const {data:surplusInventory,error:surplusInventoryError,status:surplusInventoryStatus}=await useFetch('/api/surplus',{headers:computed(()=>({'x-demo-user':identity.value})),server:false});
const {data:storageClinics,error:storageClinicError,status:storageClinicStatus}=await useFetch<{clinics:ClinicRecord[]}>(()=>`/api/agencies/${requestAgencyId.value}/clinics`,{headers:computed(()=>({'x-demo-user':identity.value})),server:false});
const enteredShipping=ref<RequestShipping>({...blankClinicAddress()});
const selectedAgencyMemberId=ref<number|''>(shippingProfile.value?.user?.agencyMemberId??agencyOptions.value?.members.find(m=>m.agencyId===requestAgencyId.value)?.id??'');
const agencyMembers=computed(()=>agencyOptions.value?.members.filter(m=>m.agencyId===requestAgencyId.value)??[]);
const requestAgencyMemberId=computed(()=>identity.value==='agency'?shippingProfile.value?.user?.agencyMemberId:agencyMembers.value.find(m=>m.id===selectedAgencyMemberId.value)?.id);
const savedShippingContact=computed<{attention?:string;email?:string;phone?:string}>(()=>{
    if(identity.value==='agency')return shippingProfile.value?.identity==='agency'?{attention:shippingProfile.value.user?.name,email:shippingProfile.value.user?.email,phone:shippingProfile.value.user?.phone}:{};
    const member=agencyMembers.value.find(member=>member.id===requestAgencyMemberId.value);
    return {attention:member?.name,email:member?.email,phone:member?.phone};
});
const shipping=computed<RequestShipping>({get:()=>({...enteredShipping.value,...shippingContact(enteredShipping.value,savedShippingContact.value)}),set:value=>{enteredShipping.value=value;}});
watch([identity,requestAgencyMemberId],()=>{enteredShipping.value={...enteredShipping.value,attention:undefined,email:undefined,phone:undefined};},{flush:'sync'});

const historyOpen = ref(false);
const form = reactive(blankRequestForm());
const { diagnosisDetailInput, diagnosisDetails, diagnosisMatchIndex, diagnosisFocused, diagnosisInput, editingDiagnosisIndex, editingDiagnosisValue, diagnosisEditError, diagnoses, pendingDiagnosis, diagnosisMatches, finishDiagnosisEdit, startDiagnosisEdit, cancelDiagnosisEdit, selectDiagnosis, commitDiagnosis, handleDiagnosisEnter, removeDiagnosis } = useRequestDiagnoses(toRef(form, 'diagnosis'), submissionError);

const { parsing, parserMessage, parserError, parserMissing, selectedPrescription, uploadedStorageKey, removeConfirmationOpen, fileInput, resolveRemoveConfirmation, removePrescription, selectPrescription, handleFileSelection, handleDrop } = usePrescriptionUpload({
    async parse(file) {
        const body = new FormData();
        body.append('prescription', file);
        const result = await $fetch<PrescriptionParseResult>('/api/requests/parse-prescription', { method: 'POST', body });
        return result;
    },
    async remove(key) {
        await $fetch('/api/requests/prescription-upload/remove', { method: 'POST', body: { key } });
    },
    removeExisting() { if (existingAttachment.value) removeExistingAttachment.value = true; },
    apply(extracted) {
        const { formulas: parsedFormulas, ...parsedFields } = extracted;
        Object.assign(form, {
            ...parsedFields,
            formulaName: extracted.formulaName || form.formulaName,
            doctorOfficePhone: formatPhoneNumber(extracted.doctorOfficePhone),
            medicalStatus: extracted.medicalStatus === 'pending' ? '' : extracted.medicalStatus,
        });
        if (parsedFormulas?.length) {
            Object.assign(form, parsedFormulas[0]);
            additionalFormulas.value = parsedFormulas.slice(1, 2);
            if (parsedFormulas.length > 2) {
                formulaAlert.value = `Only up to 2 formulas are allowed. The PDF also lists: ${parsedFormulas.slice(2).map(entry => formulaEntryName(entry, products.value)).join(', ')}. Review the uploaded documentation and use a separate request for additional formulas.`;
            }
        }
        if (!availableForms.value.includes(form.productForm as ProductForm)) {
            form.productForm = defaultFormulaForm(form.formulaName, products.value);
        }
    },
});

const isOtherFormula = computed(() => form.formulaName.trim().toLowerCase() === 'other');
const selectedFormula = computed(() => findFormula(form.formulaName, products.value));
const availableForms = computed(() => availableFormulaForms(form.formulaName, products.value));
const selectedProduct = computed(() => resolveProduct(products.value, {
    name: isOtherFormula.value ? form.otherFormulaName : form.formulaName,
    form: form.productForm, flavor: form.formulaFlavor,
}));
const productName = computed(() => isOtherFormula.value ? form.otherFormulaName.trim() : selectedFormula.value?.name ?? form.formulaName.trim());
const formulaSelectionError = computed(() => validateFormulaSelection([form, ...additionalFormulas.value].map((entry) => ({ name: formulaEntryName(entry, products.value), form: entry.productForm, flavor: entry.formulaFlavor })), products.value));
watch(formulaSelectionError, (error, previous) => { if (error && error !== previous) formulaAlert.value = error; });
function addAdditionalFormula() {
    if (!additionalFormulas.value.length) additionalFormulas.value.push(blankFormula());
}
function dismissFormulaAlert() {
    formulaAlert.value = '';
    nextTick(() => document.getElementById('extra-formula-2')?.focus());
}
const requestedFormulaNames = computed(() => [...new Set([productName.value, ...additionalFormulas.value.map(entry => formulaEntryName(entry, products.value))].filter(Boolean))]);
function surplusForms(name: string) {
    return findFormula(name, products.value) ? availableFormulaForms(name, products.value) : availableFormulaForms('Other');
}
function initializeSurplus(entry: typeof surplusEntries.value[number]) {
    const match = [form, ...additionalFormulas.value].find((formula) => formulaEntryName(formula, products.value) === entry.productName);
    entry.productForm = match?.productForm || defaultFormulaForm(entry.productName, products.value);
    entry.flavor = findFormula(entry.productName, products.value)?.hasFlavor ? match?.formulaFlavor ?? '' : '';
}
function agencySurplusStock(entry:typeof surplusEntries.value[number]){
    const lots=(surplusInventory.value?.lots??[]).filter((lot:any)=>
        lot.agencyId===requestAgencyId.value&&
        normalizeVariantText(lot.formulaName)===normalizeVariantText(entry.productName)&&
        lot.form===entry.productForm&&
        normalizeVariantText(lot.flavor??'')===normalizeVariantText(entry.flavor??''),
    );
    return {
        onHand:lots.reduce((total:number,lot:any)=>total+Number(lot.onHand??0),0),
        available:lots.reduce((total:number,lot:any)=>total+availableUnits(lot),0),
    };
}
function addSurplus() {
    const entry: typeof surplusEntries.value[number] = { productName: requestedFormulaNames.value[0] ?? '', productForm: '', flavor: '', units: '', expirationDate: '', clinicId: shipping.value.clinicId };
    initializeSurplus(entry);
    surplusEntries.value.push(entry);
}
const benefitMonthOptions = computed(() => benefitMonthLabels.map((label, index) => {
    const month = String(index + 1).padStart(2, '0');
    const saved = requestedMonths.value.find(value => value.length === 7 && value.slice(5) === month);
    const value = saved || serializeRequestedMonths([month], form.benefitsStartDate, new Date().getFullYear())[0]!;
    return {label, value, selected: requestedMonths.value.includes(value) || requestedMonths.value.includes(month)};
}));
function toggleBenefitMonth(value: string) {
    requestedMonths.value = toggleRequestedMonth(selectedBenefitMonths(), value);
}
function selectedBenefitMonths() {
    return serializeRequestedMonths(requestedMonths.value, form.benefitsStartDate, new Date().getFullYear());
}
function serializedFormulas() {
    return [form, ...additionalFormulas.value].map((entry) => ({
        productName: formulaEntryName(entry, products.value), productForm: entry.productForm as ProductForm,
        ouncesPrescribed: Number(entry.ouncesPrescribed), flavor: entry.formulaFlavor,
        otherFormulaName: entry.formulaName.trim().toLowerCase() === 'other' ? entry.otherFormulaName.trim() : undefined,
        readyToFeedJustification: requiresReadyToFeedReason(entry.formulaName, entry.productForm, products.value) ? entry.readyToFeedJustification : '',
    }));
}
watch(() => isOtherFormula.value ? 'Other' : selectedFormula.value?.name, () => {
    form.productForm = defaultFormulaForm(form.formulaName, products.value);
    form.formulaFlavor = '';
}, { flush: 'sync' });

const formulaMatches = computed(() => {
    const query = form.formulaName.trim().toLowerCase();
    return query.length >= 3 && !selectedFormula.value && !isOtherFormula.value
        ? [...catalogFormulaOptions(products.value).filter((item) => item.name.toLowerCase().includes(query)), { name: 'Other' }] : [];
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
    const restored = restoreRequestDraft(draft.form);
    Object.assign(form, restored.form);
    requestAgencyId.value=(draft as typeof draft & {request?:RequestRecord}).request?.agencyId??requestAgencyId.value;
    selectedAgencyMemberId.value=(draft as typeof draft & {request?:RequestRecord}).request?.agencyMemberId??selectedAgencyMemberId.value;
    if (restored.shipping) shipping.value = restored.shipping;
    if (restored.submissionId) submissionId.value = restored.submissionId;
    additionalFormulas.value = restored.additionalFormulas;
    surplusEntries.value = restored.surplusEntries;
    for (const entry of surplusEntries.value) if (!entry.productForm) initializeSurplus(entry);
    requestedMonths.value = restored.requestedMonths;
    diagnosisInput.value = restored.diagnosisInput;
    diagnosisDetails.value = restored.diagnosisDetails;
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
 correctingRequest.value=hasPendingMoreInfo(request);
 correctionNotes.value=request.moreInfoRequests?.filter(entry=>!entry.deletedAt&&(!entry.resubmittedAt||entry.resubmissionOpen)&&!entry.resolvedAt).map(entry=>entry.notes).join('\n\n')??'';
 const restored=restoreSubmittedForm(request);
 Object.assign(form,restored.form);
 additionalFormulas.value=restored.additionalFormulas;
 surplusEntries.value=restored.surplusEntries;
 requestedMonths.value=restored.requestedMonths;
 requestAgencyId.value=request.agencyId;
 selectedAgencyMemberId.value=request.agencyMemberId;
 if(restored.shipping) shipping.value={...restored.shipping};
 editingRevision.value=request.revision??0;
 submissionId.value=request.submissionId??`legacy-${request.id}`;
 editLocked.value=identity.value!=='agency'||!canEditSubmission(request);
 existingAttachment.value=request.prescriptionAttachment;
 if(request.prescriptionAttachment)selectedPrescription.value=new File([],request.prescriptionAttachment.fileName);
}

watch(requestAgencyId,()=>{for(const entry of surplusEntries.value)entry.clinicId=undefined;shipping.value={...blankClinicAddress(),attention:shipping.value.attention,email:shipping.value.email,phone:shipping.value.phone};selectedAgencyMemberId.value=agencyMembers.value[0]?.id??'';},{flush:'sync'});
watch(()=>shippingProfile.value?.user?.agencyId,agencyId=>{if(identity.value==='agency'&&agencyId)requestAgencyId.value=agencyId;});

async function saveRequest() {
    if (saving.value || parsing.value) return;
    finishDiagnosisEdit(false);
    draftSavedNotice.value = '';
    saving.value = true;
    submissionError.value = '';
    try {
        if(editingId.value){
            const result=await $fetch<{request:RequestRecord}>(`/api/requests/${editingId.value}/submission`,{method:'PUT',headers:{'x-demo-user':identity.value},body:submissionBody(true)});
            editingRevision.value=result.request.revision??0;existingAttachment.value=result.request.prescriptionAttachment;uploadedStorageKey.value='';removeExistingAttachment.value=false;draftSavedNotice.value='Information saved. Resubmit when corrections are complete.';return;
        }
        const result = await $fetch<{ request: RequestRecord }>('/api/requests/drafts', {
            method: 'POST', headers: { 'x-demo-user': identity.value },
            body: {
                id: draftId.value,
                agencyId:requestAgencyId.value,agencyMemberId:requestAgencyMemberId.value,
                form: serializeRequestDraft(form, {
                    shipping: shipping.value,
                    submissionId: submissionId.value,
                    diagnosisInput: diagnosisInput.value,
                    diagnosisDetails: diagnosisDetails.value,
                    additionalFormulas: additionalFormulas.value,
                    surplusEntries: surplusEntries.value,
                    requestedMonths: requestedMonths.value,
                }),
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

const hasRequiredDocumentation = computed(() => hasMedicalDocumentation({
    temporaryKey: uploadedStorageKey.value,
    existingKey: existingAttachment.value?.storageKey,
    removeExisting: removeExistingAttachment.value,
}));

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
        if(control.dataset.inactiveClinic==='true')control.setCustomValidity('This clinic address is archived. Select an active clinic or enter a new address.');
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
        for (const [key, message] of Object.entries(getFormulaFieldErrors(entry, products.value))) setError(ids[key as keyof typeof ids], message!);
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
watch([form, additionalFormulas, surplusEntries, diagnosisInput, diagnosisDetails, requestForm, validationAttempted, shipping], syncFieldValidity, {deep:true, flush:'post', immediate:true});

function submissionBody(saveOnly = false) {
    return requestSubmissionBody(form, {
        draftId: draftId.value,
        revision: editingRevision.value,
        removePrescriptionAttachment: removeExistingAttachment.value,
        submissionId: submissionId.value,
        agencyId: requestAgencyId.value,
        agencyMemberId: requestAgencyMemberId.value,
        shipping: shipping.value,
        benefitMonthsRequested: selectedBenefitMonths(),
        productId: selectedProduct.value?.id,
        productName: productName.value,
        requestedFormulas: serializedFormulas(),
        surplusItems: surplusEntries.value,
        hasFlavor: selectedFormula.value?.hasFlavor,
        isOtherFormula: isOtherFormula.value,
        prescriptionKey: uploadedStorageKey.value,
    }, saveOnly);
}
async function submitRequest() {
    submitted.value = false;
    if (saving.value || parsing.value) return;
    validationAttempted.value = true;
    const diagnosisEdited=finishDiagnosisEdit();
    const diagnosisCommitted = commitDiagnosis() && diagnosisEdited;
    await nextTick();
    syncFieldValidity();
    const invalid = requestForm.value?.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid, [data-required-group][aria-invalid="true"]');
    if (invalid || !diagnosisCommitted) {
        submissionError.value = 'Complete the fields highlighted in red before submitting. You can still Save an incomplete request.';
        invalid?.focus();
        if (invalid && 'reportValidity' in invalid) (invalid as HTMLInputElement).reportValidity();
        return;
    }
    submissionError.value = formulaSelectionError.value || validateAgencyFields(form, products.value);
    if (!submissionError.value && ((!selectedFormula.value && !isOtherFormula.value) || (isOtherFormula.value && (!form.otherFormulaName.trim() || form.otherFormulaName.trim().toLowerCase() === 'other')) || !availableForms.value.includes(form.productForm as ProductForm))) {
        submissionError.value = 'Select a matching formula name and an available form.';
    }
    if (!submissionError.value) {
        for (const [index, entry] of additionalFormulas.value.entries()) {
            const error = validateFormulaEntry(entry, products.value);
            if (error) { submissionError.value = `Formula ${index + 2}: ${error}`; break; }
        }
    }
    if (!submissionError.value && surplusEntries.value.some((entry) => !requestedFormulaNames.value.includes(entry.productName) || !Number.isFinite(Number(entry.units)) || Number(entry.units) <= 0)) {
        submissionError.value = 'Select a requested formula and enter a positive surplus quantity.';
    }
    if (!submissionError.value) submissionError.value = validateBreastfeeding(form);
    if (!submissionError.value) submissionError.value = validateShipping(shipping.value);
    if (!submissionError.value) submissionError.value = validateRequestedMonths(selectedBenefitMonths());
    if (!submissionError.value && surplusEntries.value.some((entry) => !entry.productForm || !surplusForms(entry.productName).includes(entry.productForm))) submissionError.value = 'Select a valid Form for each surplus entry.';
    if (submissionError.value) return;
    saving.value = true;
    try {
        const body = submissionBody();
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
            <p v-if="editingId&&!editLocked">{{correctingRequest?'Update the requested information and Resubmit to CDPH/WIC.':'You can update this submission until Admin or FPU opens it.'}}</p>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/requests"
            >Cancel</NuxtLink
        >
    </div>
    <div v-if="correctingRequest" class="correction-request-note"><strong>Request More Info</strong><p>{{correctionNotes}}</p></div>
    <p v-if="editLocked" role="alert">Admin/FPU has opened this submission. Its submitted form can no longer be edited.</p>
    <form v-else
        ref="requestForm"
        class="panel form-panel request-form"
        :class="{'validation-attempted': validationAttempted, 'history-visible': historyOpen}"
        novalidate
        @submit.prevent="submitRequest"
    >
        <section class="form-section prescription-first">
            <div class="panel-heading">
                <div>
                    <h2>Medical Documentation *</h2>
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
                data-required-group
                tabindex="-1"
                aria-label="Medical Documentation"
                :aria-invalid="validationAttempted && !hasRequiredDocumentation"
                @dragover.prevent
                @drop.prevent="handleDrop"
            >
                <template v-if="!selectedPrescription">
                    <strong>Drag and drop medical documentation here</strong>
                    <span>Choose a PDF or image.<br />PDFs populate matching form fields; images require manual entry.</span>
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
            <p v-if="validationAttempted && !hasRequiredDocumentation" class="field-error" role="alert">{{ medicalDocumentationRequiredMessage }}</p>
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

        <RequestParticipantFields :form="form" :editing-id="editingId" :requested-months="requestedMonths" :benefit-month-options="benefitMonthOptions" @toggle-month="toggleBenefitMonth" @preview="historyOpen=$event" />

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
                            <small v-if="form.otherFormulaName.trim() && validateOtherFormulaName(form.otherFormulaName, products)" id="other-formula-error" class="field-error" role="alert">{{ validateOtherFormulaName(form.otherFormulaName, products) }}</small>
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
                            <label for="ounces">Amount (in ounces/day) *</label>
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
                            v-if="requiresReadyToFeedReason(form.formulaName, form.productForm, products)"
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
                    <AdditionalFormulaFields :products="products" v-model="additionalFormulas[index]!" :index="index + 2" />
                    <p v-if="formulaSelectionError" class="field-error" role="alert">{{ formulaSelectionError }}</p>
                    <button class="text-button" type="button" @click="additionalFormulas.splice(index, 1)">Remove Formula {{ index + 2 }}</button>
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
                        <option value="" disabled>Select</option>
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
                        <li v-for="(diagnosis, index) in diagnoses" :key="index" :class="{'diagnosis-is-editing':editingDiagnosisIndex===index}">
                            <RequestDiagnosisEditor v-if="editingDiagnosisIndex===index" v-model="editingDiagnosisValue" :index="index" />
                            <span v-else>{{ diagnosis }}</span>
                            <div class="diagnosis-entry-actions">
                                <button v-if="editingDiagnosisIndex===index" type="button" class="text-button" :aria-label="`Done editing diagnosis ${index+1}`" @click="finishDiagnosisEdit()">Done</button>
                                <button v-else type="button" class="text-button" :aria-label="`Edit diagnosis: ${diagnosis}`" @click="startDiagnosisEdit(index)">Edit</button>
                                <button v-if="editingDiagnosisIndex===index" type="button" class="text-button" @click="cancelDiagnosisEdit">Cancel</button>
                                <button type="button" class="text-button" :aria-label="`Remove diagnosis: ${diagnosis}`" @click="removeDiagnosis(index)">Remove</button>
                            </div>
                            <p v-if="editingDiagnosisIndex===index && diagnosisEditError" class="form-error diagnosis-edit-error" role="alert">{{diagnosisEditError}}</p>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <RequestFoodRestrictionFields :form="form" :validation-attempted="validationAttempted" />

        <RequestProviderFields :form="form" />

        <section class="form-section">
            <div class="panel-heading"><h2>Surplus Formula</h2></div>
            <p>Enter any surplus the local agency has of the formula(s) requested.</p>
            <p v-if="surplusInventoryStatus==='pending'" class="surplus-stock-note" role="status">Checking current inventory for the requesting local agency…</p>
            <p v-else-if="surplusInventoryError" class="surplus-stock-note" role="status">Current inventory could not be loaded. You can still enter the local agency’s surplus below.</p>
            <p v-if="storageClinicError" role="alert">Storage clinics could not be loaded. Try again before choosing a clinic.</p>
            <div v-for="(entry, index) in surplusEntries" :key="index" class="form-grid surplus-form-row">
                <p v-if="entry.productName && entry.productForm && surplusInventory" class="surplus-stock-note">
                    On Hand at requesting agency: {{agencySurplusStock(entry).onHand}} {{unitLabel(agencySurplusStock(entry).onHand)}} · Available: {{agencySurplusStock(entry).available}} {{unitLabel(agencySurplusStock(entry).available)}}
                </p>
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
                <div v-if="findFormula(entry.productName, products)?.hasFlavor" class="form-field">
                    <label :for="`surplus-flavor-${index}`">Flavor</label>
                    <input :id="`surplus-flavor-${index}`" v-model="entry.flavor" class="form-input" />
                </div>
                <div class="form-field">
                    <label :for="`surplus-units-${index}`">Surplus Quantity (in Units)</label>
                    <input :id="`surplus-units-${index}`" v-model="entry.units" class="form-input" type="number" min="1" required />
                </div>
                <div class="form-field">
                    <label :for="`surplus-expiration-${index}`">Expiration Date</label>
                    <input :id="`surplus-expiration-${index}`" v-model="entry.expirationDate" class="form-input" type="date" />
                </div>
                <div class="form-field"><label :for="`surplus-clinic-${index}`">Storage clinic</label><select :id="`surplus-clinic-${index}`" v-model="entry.clinicId" class="form-input" :disabled="storageClinicStatus==='pending'"><option :value="undefined">Clinic not specified</option><option v-if="entry.clinicId &amp;&amp; !storageClinics?.clinics.some(c=>c.id===entry.clinicId)" :value="entry.clinicId" disabled>Previously selected clinic unavailable — choose a clinic</option><option v-for="clinic in storageClinics?.clinics" :key="clinic.id" :value="clinic.id">{{clinic.clinicName}}</option></select><small>Select the clinic where this stock is stored.</small></div>
                <button type="button" class="text-button" @click="surplusEntries.splice(index, 1)">Remove surplus entry</button>
            </div>
            <button class="button button-ghost add-surplus-button" type="button" @click="addSurplus">Add surplus</button>
        </section>

        <section class="form-section shipping-section">
            <div class="panel-heading"><h2>Shipping</h2></div>
            <div v-if="identity==='admin'" class="form-field"><label for="shipping-agency">Local Agency</label><select id="shipping-agency" v-model.number="requestAgencyId" class="form-input" required :disabled="!!editingId"><option v-for="agency in agencyOptions?.agencies??[]" :key="agency.id" :value="agency.id">{{agency.name}}</option></select></div>
            <div v-if="identity==='admin'" class="form-field"><label for="shipping-representative">Local Agency Representative</label><select id="shipping-representative" v-model.number="selectedAgencyMemberId" class="form-input" required><option disabled value="">Select a representative</option><option v-for="member in agencyMembers" :key="member.id" :value="member.id">{{member.name}}</option></select><small v-if="!agencyMembers.length">This local agency needs a representative before a request can be submitted. You can still Save an incomplete request.</small></div>
            <RequestShippingFields :allow-saved-snapshot="!!editingId" :key="`${identity}-${requestAgencyId}`" v-model="shipping" :agency-id="requestAgencyId" />
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
            <button v-if="!editingId || correctingRequest" class="button button-ghost" type="button" :disabled="saving || parsing" @click="saveRequest">Save</button>
            <button v-if="!editingId" class="button button-ghost" type="button" :disabled="saving || parsing" @click="router.push('/requests')">Close</button>
            <button v-if="!editingId" class="button button-danger" type="button" :disabled="saving || parsing" @click="deleteConfirmationOpen=true">Delete</button>
            <button
                class="button button-primary"
                type="submit"
                :disabled="saving || parsing"
            >
                {{ saving ? 'Saving…' : correctingRequest?'Resubmit':editingId?'Save Changes':'Submit' }}
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

<style scoped>.correction-request-note{border-left:3px solid #902A92;padding:12px 16px;margin-bottom:16px;}.correction-request-note p{white-space:pre-wrap;overflow-wrap:anywhere;}</style>

<style scoped>
.diagnosis-entry-actions {display:flex;gap:12px;flex-shrink:0;}
.diagnosis-list .diagnosis-is-editing {align-items:flex-start;flex-wrap:wrap;}
.diagnosis-edit-error {flex-basis:100%;margin:0;}
.diagnosis-is-editing .diagnosis-entry-actions {padding-top:5px;}
@media (max-width:600px){.diagnosis-list .diagnosis-is-editing {flex-wrap:wrap;}}
</style>

<style scoped>
@media(min-width:901px) {.request-form.history-visible {width:calc(55vw - 64px);margin-right:45vw;}}
@media(max-width:900px) {.request-form.history-visible {padding-bottom:48dvh;}}
</style>
