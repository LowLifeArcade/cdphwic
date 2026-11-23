<script setup lang="ts">
import { breastfeedingOptions } from '#shared/breastfeeding';
import type { RequestForm } from '../requestForm';
defineProps<{
    form: RequestForm;
    editingId?: number;
    requestedMonths: string[];
    benefitMonthOptions: Array<{
        value: string;
        label: string;
        selected: boolean;
    }>;
}>();
const emit = defineEmits<{
    preview: [open: boolean];
    toggleMonth: [month: string];
}>();
function requiredLabel(label: string) {
    return label + ' *';
}
</script>

<template>
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
                    <RequestHistory v-if="form.requestKind === 'extension'" class="full" :family-id="form.familyId" :individual-id="form.individualId" :name="`${form.patientFirstName} ${form.patientLastName}`" :dob="form.participantDob" :current-id="editingId" context="form" @preview="emit('preview', $event)" />
                    <div class="form-field">
                        <label for="breastfeeding">Breastfeeding</label>
                        <select id="breastfeeding" v-model="form.breastfeedingStatus" class="form-input" @change="form.breastfeedingDiscontinuedDate = ''">
                            <option value="">Select</option>
                            <option v-for="option in breastfeedingOptions" :key="option" :value="option">{{option}}</option>
                        </select>
                    </div>
                    <div v-if="form.breastfeedingStatus === 'Discontinued BF'" class="form-field">
                        <label for="breastfeeding-discontinued-date">Date BF Discontinued</label>
                        <input id="breastfeeding-discontinued-date" v-model="form.breastfeedingDiscontinuedDate" type="date" class="form-input" required />
                    </div>
                </div>
                <fieldset class="benefit-month-picker">
                    <legend>Benefit Month(s) Requested</legend>
                    <small>Select up to 3 months.</small>
                    <div class="benefit-month-options">
                        <label v-for="month in benefitMonthOptions" :key="month.value" class="benefit-month-option" :class="{ 'month-selected': month.selected }">
                            <input type="checkbox" :checked="month.selected"
                                :disabled="requestedMonths.length >= 3 && !month.selected"
                                @change="emit('toggleMonth', month.value)" />
                            {{ month.label }}
                        </label>
                    </div>
                </fieldset>
            </fieldset>
        </section>
</template>

<style scoped>
.participant-grid {align-items:start;}
.insurance-fields {display:grid;gap:16px;align-content:start;}
</style>
