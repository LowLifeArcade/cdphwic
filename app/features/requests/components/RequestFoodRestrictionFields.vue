<script setup lang="ts">
import type { RequestForm } from '../requestForm';
defineProps<{
    form: RequestForm;
    validationAttempted: boolean;
}>();
function requiredLabel(label: string) {
    return label + ' *';
}
</script>

<template>
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
</template>
