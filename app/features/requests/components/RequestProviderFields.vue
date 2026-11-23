<script setup lang="ts">
import { formatPhoneNumber } from '#shared/phone';
import type { RequestForm } from '../requestForm';
const props = defineProps<{
    form: RequestForm;
}>();
function requiredLabel(label: string) {
    return label + ' *';
}
function formatDoctorPhone(event: Event) {
    const input = event.target as HTMLInputElement;
    props.form.doctorOfficePhone = formatPhoneNumber(input.value);
    input.value = props.form.doctorOfficePhone;
}
</script>

<template>
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
</template>
