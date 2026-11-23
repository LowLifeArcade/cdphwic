<script setup lang="ts">
import { ref } from 'vue';
import type { ProductRecord, RequestRecord } from '#shared/domain';
import {
    formatDisplayDate,
    participantAgeAtBenefitsStart,
    insuranceDetails,
    requestedMonthLabels,
    requestFormulas,
    formulaFormLabel,
    foodRestrictionLabel,
    providerAddressLines,
} from '#shared/requestPresentation';
import { breastfeedingOptions } from '#shared/breastfeeding';
import { formatPhoneNumber } from '#shared/phone';
import { blankFormula, type FormulaEntry } from '#shared/formulaEntries';
import type { participantAgeAlerts } from '#shared/participantAgeAlerts';
const props = defineProps<{
    request: RequestRecord;
    draft: Partial<RequestRecord>;
    products?: ProductRecord[];
    canStaffEdit: boolean;
    saving: boolean;
    editingSection: 'participant' | 'overview' | 'prescription' | 'food' | 'shipping' | null;
    editableFormulas: FormulaEntry[];
    editableDiagnoses: string[];
    ageMilestoneAlerts: ReturnType<typeof participantAgeAlerts>;
    benefitMonths: Array<{
        value: string;
        label: string;
    }>;
    error: string;
}>();
const emit = defineEmits<{
    edit: [section: 'participant' | 'overview' | 'prescription' | 'food'];
    cancel: [];
    save: [];
    addMonth: [];
    removeMonth: [index: number];
}>();
const prescriptionSection = ref<HTMLElement>();
function focusPrescription() {
    prescriptionSection.value?.querySelector<HTMLElement>('h3')?.focus({
        preventScroll: true,
    });
    prescriptionSection.value?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
    });
}
function formatDoctorPhone(event: Event) {
    const input = event.target as HTMLInputElement;
    props.draft.doctorOfficePhone = formatPhoneNumber(input.value);
    input.value = props.draft.doctorOfficePhone;
}
defineExpose({
    focusPrescription,
});
</script>

<template>
        <section class="detail-section participant-summary">
            <div class="section-heading">
                <h3>Participant</h3>
                <button v-if="canStaffEdit && request.status!=='denied' && editingSection !== 'participant'" class="text-button" type="button" @click="emit('edit', 'participant')">Edit</button>
            </div>
            <div v-if="canStaffEdit && ageMilestoneAlerts.length" class="participant-age-alert" role="alert">
                <strong>Upcoming age milestone</strong>
                <p v-for="alert in ageMilestoneAlerts" :key="alert.milestone">Participant turns {{alert.milestone}} {{alert.daysUntil === 0 ? 'today' : `in ${alert.daysUntil} ${alert.daysUntil === 1 ? 'day' : 'days'}`}} ({{formatDisplayDate(alert.date)}}).</p>
            </div>
            <div v-if="editingSection === 'participant'" class="form-grid compact-form-grid">
                <label class="field-label">Participant First Name<input v-model="draft.participantFirstName" class="form-input" autocomplete="given-name" required /></label>
                <label class="field-label">Participant Last Name<input v-model="draft.participantLastName" class="form-input" autocomplete="family-name" required /></label>
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
                            <select v-model="draft.benefitMonthsRequested![index]" class="form-input">
                                <option v-for="option in benefitMonths" :key="option.value" :value="option.value" :disabled="option.value !== month && draft.benefitMonthsRequested?.includes(option.value)">{{ requestedMonthLabels([option.value]) }}</option>
                            </select>
                            <button class="icon-button" type="button" :aria-label="`Remove ${requestedMonthLabels([month])}`" @click="emit('removeMonth', index)">×</button>
                        </div>
                        <button v-if="(draft.benefitMonthsRequested?.length ?? 0) < 3" class="text-button" type="button" @click="emit('addMonth')">+ Add requested month</button>
                    </div>
                </div>
            </div>
            <div v-if="editingSection === 'participant'" class="form-actions">
                <button class="button button-ghost" type="button" @click="emit('cancel')">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="emit('save')">Save Section</button>
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
                <button v-if="canStaffEdit && request.status!=='denied' && editingSection !== 'overview'" class="text-button" type="button" @click="emit('edit', 'overview')">Edit</button>
            </div>
            <div v-if="editingSection === 'overview'" class="form-grid compact-form-grid prescription-editor">
                <fieldset v-for="(formula,index) in editableFormulas" :key="index" class="detail-field-wide submitted-formula-card formula-edit-card">
                    <legend v-if="editableFormulas.length > 1">Formula {{index + 1}}</legend>
                    <AdditionalFormulaFields :products="products" v-model="editableFormulas[index]!" :index="index + 1" auto-fit-justification hide-required-markers />
                    <button v-if="index > 0" class="text-button" type="button" @click="editableFormulas.splice(index,1)">Remove Formula {{index + 1}}</button>
                </fieldset>
                <div v-if="editableFormulas.length < 2" class="detail-field-wide add-formula-action"><button class="button button-ghost add-formula-button" type="button" @click="editableFormulas.push(blankFormula())">Add another formula</button></div>
                <label class="field-label duration-field">Duration (in months)<input required v-model.number="draft.durationMonths" class="form-input" type="number" min="1" max="6" /></label>
                <fieldset class="detail-field-wide diagnosis-editor">
                    <legend>Qualifying Diagnosis(es)</legend>
                    <div v-for="(_, index) in editableDiagnoses" :key="index" class="diagnosis-edit-row">
                        <RequestDiagnosisEditor v-model="editableDiagnoses[index]!" :index="index" />
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
                <button class="button button-ghost" type="button" @click="emit('cancel')">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="emit('save')">Save Section</button>
            </div>
        </section>
        <section class="detail-section">
            <div class="section-heading">
                <h3>WIC Food Restrictions</h3>
                <button v-if="canStaffEdit && request.status!=='denied' && editingSection !== 'food'" class="text-button" type="button" @click="emit('edit', 'food')">Edit</button>
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
                <button class="button button-ghost" type="button" @click="emit('cancel')">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="emit('save')">Save Section</button>
            </div>
        </section>
        <section class="detail-section">
            <div class="section-heading">
                <h3>Health Care Provider</h3>
                <button v-if="canStaffEdit && request.status!=='denied' && editingSection !== 'prescription'" class="text-button" type="button" @click="emit('edit', 'prescription')">Edit</button>
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
                <button class="button button-ghost" type="button" @click="emit('cancel')">Cancel</button>
                <button class="button button-secondary" type="button" :disabled="saving" @click="emit('save')">Save Section</button>
            </div>
        </section>
</template>
