<script setup lang="ts">
import { diagnosisCatalog, findDiagnosis } from '~/../shared/diagnosisCatalog';
const props = defineProps<{ modelValue: string; index: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const focused = ref(false);
const matchIndex = ref(0);
const detailsInput = ref<HTMLInputElement>();
const name = computed(() => props.modelValue.split(':')[0]!);
const details = computed(() => props.modelValue.split(':').slice(1).join(':').replace(/^ /, ''));
const choice = computed(() => findDiagnosis(name.value));
const matches = computed(() => name.value && !choice.value ? diagnosisCatalog.filter(item => item.name.toLowerCase().includes(name.value.toLowerCase())) : []);
function updateName(value: string) {
    matchIndex.value = 0;
    const matched = findDiagnosis(value);
    emit('update:modelValue', (!matched || matched.detail) && details.value ? `${matched.name}: ${details.value}` : matched?.name ?? value);
}
function selectName(value: string) {
    updateName(value);
    focused.value = false;
    if (findDiagnosis(value)?.detail) nextTick(() => detailsInput.value?.focus());
}
function enter() {
    const match = matches.value[matchIndex.value];
    if (match && focused.value) selectName(match.name);
    else if (choice.value?.detail) detailsInput.value?.focus();
}
</script>
<template>
    <div class="request-diagnosis-editor">
        <label class="field-label" :for="`edit-diagnosis-${index}`">Diagnosis {{ index + 1 }}</label>
        <input :id="`edit-diagnosis-${index}`" :value="name" class="form-input"
            placeholder="Start typing a diagnosis and press Enter to select."
            autocomplete="off" @input="updateName(($event.target as HTMLInputElement).value)"
            @focus="focused = true" @blur="focused = false"
            @keydown.down.prevent="matchIndex = Math.min(matchIndex + 1, matches.length - 1)"
            @keydown.up.prevent="matchIndex = Math.max(matchIndex - 1, 0)"
            @keydown.enter.prevent="enter" />
        <div v-if="focused && matches.length" class="form-suggestions" aria-label="Matching diagnoses">
            <button v-for="(item, itemIndex) in matches" :key="item.name" type="button"
                :class="{ 'suggestion-active': itemIndex === matchIndex }"
                @pointerdown.prevent @click="selectName(item.name)">{{ item.name }}</button>
        </div>
        <label v-if="choice?.detail || details" class="field-label" :for="`edit-diagnosis-details-${index}`">Details for {{ choice?.name || name }}{{ choice?.detail ? ' *' : '' }}
            <input :id="`edit-diagnosis-details-${index}`" ref="detailsInput" :value="details" :required="choice?.detail" class="form-input"
                @input="emit('update:modelValue', `${choice?.name || name}: ${($event.target as HTMLInputElement).value}`)" />
        </label>
    </div>
</template>
<style scoped>
.request-diagnosis-editor { flex: 1; min-width: 0; display: grid; gap: 7px; }
</style>
