import { expect, it } from 'vitest';
import { reactive, ref, toRef } from 'vue';
import { useRequestDiagnoses } from '../app/features/requests/composables/useRequestDiagnoses';

function setup(value = '') {
    const form = reactive({ diagnosis: value });
    const error = ref('');
    return { form, error, ...useRequestDiagnoses(toRef(form, 'diagnosis'), error) };
}

it('adds diagnoses, requires detail when indicated, and clears pending text after commit', () => {
    const state = setup('Prematurity');
    state.selectDiagnosis('Food allergy');
    expect(state.commitDiagnosis()).toBe(false);
    expect(state.error.value).toContain('Provide details');
    state.diagnosisDetails.value = ' Peanut allergy ';
    expect(state.commitDiagnosis()).toBe(true);
    expect(state.diagnoses.value).toEqual(['Prematurity', 'Food allergy: Peanut allergy']);
    expect(state.diagnosisInput.value).toBe('');
    expect(state.error.value).toBe('');
});
it('preserves edits on invalid detail, supports cancel, and updates the correct entry after removing an earlier row', () => {
    const state = setup('Prematurity;Dysphagia');
    state.startDiagnosisEdit(1);
    state.editingDiagnosisValue.value = 'Food allergy';
    expect(state.finishDiagnosisEdit()).toBe(false);
    expect(state.form.diagnosis).toBe('Prematurity;Dysphagia');
    state.removeDiagnosis(0);
    expect(state.editingDiagnosisIndex.value).toBe(0);
    state.editingDiagnosisValue.value = 'Food allergy: Milk';
    expect(state.finishDiagnosisEdit()).toBe(true);
    expect(state.form.diagnosis).toBe('Food allergy: Milk');
    state.startDiagnosisEdit(0);
    state.editingDiagnosisValue.value = 'Unsaved';
    state.cancelDiagnosisEdit();
    expect(state.form.diagnosis).toBe('Food allergy: Milk');
});
it('owns independent state per form and follows external form restoration', () => {
    const first = setup('Prematurity');
    const second = setup();
    first.diagnosisInput.value = 'Dysphagia';
    first.commitDiagnosis();
    expect(second.diagnoses.value).toEqual([]);
    first.form.diagnosis = 'Restored diagnosis';
    expect(first.diagnoses.value).toEqual(['Restored diagnosis']);
});
