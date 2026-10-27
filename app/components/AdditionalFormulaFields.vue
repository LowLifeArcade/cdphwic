<script setup lang="ts">
import { formulaCatalog, findFormula, availableFormulaForms, defaultFormulaForm, requiresReadyToFeedReason } from '~/../shared/formulaCatalog';
import { validateOtherFormulaName } from '~/../shared/formulaEntries';
import type { FormulaEntry } from '~/../shared/formulaEntries';
const props = defineProps<{ modelValue: FormulaEntry; index: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: FormulaEntry] }>();
const focused = ref(false);
const active = ref(0);
const prefix = computed(() => `extra-formula-${props.index}`);
const selected = computed(() => findFormula(props.modelValue.formulaName));
const other = computed(() => props.modelValue.formulaName.trim().toLowerCase() === 'other');
const forms = computed(() => availableFormulaForms(props.modelValue.formulaName));
const matches = computed(() => {
    const query = props.modelValue.formulaName.trim().toLowerCase();
    return query.length >= 3 && !selected.value && !other.value
        ? [...formulaCatalog.filter((item) => item.name.toLowerCase().includes(query)), { name: 'Other' }] : [];
});
function update<K extends keyof FormulaEntry>(key: K, value: FormulaEntry[K]) {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
}
function nameChanged(value: string) {
    active.value = 0;
    emit('update:modelValue', { ...props.modelValue, formulaName: value, productForm: defaultFormulaForm(value) });
}
</script>

<template>
    <div class="form-grid formula-entry-grid" :class="{'has-formula-details': other || selected?.hasFlavor, 'has-other-formula': other}">
        <div class="form-field formula-name-field">
            <label :for="prefix">Formula Name *</label>
            <div class="formula-autocomplete">
                <input :id="prefix" :value="modelValue.formulaName" class="form-input" required autocomplete="off"
                    placeholder="Start typing a formula name or type Other"
                    role="combobox" aria-autocomplete="list" :aria-controls="`${prefix}-matches`"
                    :aria-expanded="focused && matches.length > 0"
                    :aria-activedescendant="focused && matches.length ? `${prefix}-match-${active}` : undefined"
                    @input="nameChanged(($event.target as HTMLInputElement).value); focused = true"
                    @focus="focused = true" @blur="focused = false" @keydown.esc.prevent="focused = false"
                    @keydown.down.prevent="active = Math.min(active + 1, matches.length - 1)"
                    @keydown.up.prevent="active = Math.max(active - 1, 0)"
                    @keydown.enter.prevent="matches[active] && nameChanged(matches[active]!.name)" />
                <div v-if="focused && matches.length" :id="`${prefix}-matches`" class="form-suggestions formula-dropdown" role="listbox" aria-label="Matching formulas">
                    <button v-for="(item, matchIndex) in matches" :id="`${prefix}-match-${matchIndex}`" :key="item.name" type="button" role="option" tabindex="-1"
                        :aria-selected="active === matchIndex" :class="{ 'suggestion-active': active === matchIndex }"
                        @pointerdown.prevent @click="nameChanged(item.name)">{{ item.name }}</button>
                </div>
            </div>
        </div>
        <div v-if="other" class="form-field formula-detail-field">
            <label :for="`${prefix}-other`">Other Formula Name *</label>
            <input :id="`${prefix}-other`" :value="modelValue.otherFormulaName" class="form-input" required @input="update('otherFormulaName', ($event.target as HTMLInputElement).value)" />
            <small v-if="modelValue.otherFormulaName.trim() && validateOtherFormulaName(modelValue.otherFormulaName)" class="field-error" role="alert">{{ validateOtherFormulaName(modelValue.otherFormulaName) }}</small>
        </div>
        <div v-if="selected?.hasFlavor" class="form-field formula-detail-field">
            <label :for="`${prefix}-flavor`">Flavor</label>
            <input :id="`${prefix}-flavor`" :value="modelValue.formulaFlavor" class="form-input" @input="update('formulaFlavor', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="form-field formula-form-field">
            <label :for="`${prefix}-form`">Form *</label>
            <select :id="`${prefix}-form`" :value="modelValue.productForm" class="form-input" required @change="update('productForm', ($event.target as HTMLSelectElement).value as FormulaEntry['productForm'])">
                <option disabled value="">Select Form</option>
                <option v-for="item in forms" :key="item" :value="item">{{ { powder: 'Powder', concentrate: 'Liquid Concentrate', 'ready-to-feed': 'Ready-to-Feed' }[item] }}</option>
            </select>
        </div>
        <div class="form-field formula-amount-field">
            <label :for="`${prefix}-amount`">Amount (in ounces per day)</label>
            <input :id="`${prefix}-amount`" :value="modelValue.ouncesPrescribed" class="form-input" type="text" inputmode="decimal" pattern="(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)" required @input="update('ouncesPrescribed', ($event.target as HTMLInputElement).value)" />
        </div>
        <div v-if="requiresReadyToFeedReason(modelValue.formulaName, modelValue.productForm)" class="form-field formula-justification-field">
            <label :for="`${prefix}-reason`">Justification *</label>
            <textarea :id="`${prefix}-reason`" :value="modelValue.readyToFeedJustification" placeholder='List reason(s) why ready-to-feed is needed. Otherwise, type "Only form available"'  class="form-textarea rtf-reason" rows="1" required @input="update('readyToFeedJustification', ($event.target as HTMLTextAreaElement).value)" />
        </div>
    </div>
</template>
