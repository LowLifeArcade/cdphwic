import { computed, nextTick, ref, type Ref } from 'vue';
import { diagnosisCatalog, findDiagnosis, validateDiagnoses } from '#shared/diagnosisCatalog';
import { addDiagnosis } from '#shared/newRequestFields';
export function useRequestDiagnoses(diagnosis: Ref<string>, submissionError: Ref<string>) {
    const diagnosisFocused = ref(false);
    const diagnosisMatchIndex = ref(0);
    const diagnosisDetails = ref('');
    const diagnosisDetailInput = ref<HTMLInputElement | null>(null);
    const diagnosisInput = ref('');
    const editingDiagnosisIndex = ref<number | null>(null);
    const editingDiagnosisValue = ref('');
    const diagnosisEditError = ref('');
    function finishDiagnosisEdit(validate = true) {
        if (editingDiagnosisIndex.value === null) {
            return true;
        }
        const value = editingDiagnosisValue.value.trim();
        const error = validate ? validateDiagnoses(value) : '';
        if (error) {
            diagnosisEditError.value = error;
            return false;
        }
        const entries = [...diagnoses.value];
        entries[editingDiagnosisIndex.value] = value;
        diagnosis.value = entries.filter(Boolean).join('\n');
        editingDiagnosisIndex.value = null;
        diagnosisEditError.value = '';
        return true;
    }
    function startDiagnosisEdit(index: number) {
        if (!finishDiagnosisEdit()) {
            return;
        }
        editingDiagnosisValue.value = diagnoses.value[index] ?? '';
        editingDiagnosisIndex.value = index;
        diagnosisEditError.value = '';
    }
    function cancelDiagnosisEdit() {
        editingDiagnosisIndex.value = null;
        diagnosisEditError.value = '';
    }
    const diagnoses = computed(() =>
        diagnosis.value
            .split(/[\n;]/)
            .map((value) => value.trim())
            .filter(Boolean),
    );
    const pendingDiagnosis = computed(() => findDiagnosis(diagnosisInput.value));
    const diagnosisMatches = computed(() =>
        diagnosisInput.value.trim() && !pendingDiagnosis.value
            ? diagnosisCatalog.filter((item) =>
                  item.name.toLowerCase().includes(diagnosisInput.value.trim().toLowerCase()),
              )
            : [],
    );
    function selectDiagnosis(name: string) {
        diagnosisInput.value = name;
        diagnosisDetails.value = '';
        diagnosisMatchIndex.value = 0;
        if (findDiagnosis(name)?.detail) {
            nextTick(() => diagnosisDetailInput.value?.focus());
        }
    }
    function commitDiagnosis() {
        const input = diagnosisInput.value.trim();
        if (!input) {
            return true;
        }
        const choice = findDiagnosis(input);
        if (choice?.detail && !diagnosisDetails.value.trim()) {
            submissionError.value = `Provide details for ${choice.name}.`;
            nextTick(() => diagnosisDetailInput.value?.focus());
            return false;
        }
        const entry = choice?.detail ? `${choice.name}: ${diagnosisDetails.value.trim()}` : (choice?.name ?? input);
        diagnosis.value = addDiagnosis(diagnoses.value, entry).join('\n');
        diagnosisInput.value = '';
        diagnosisDetails.value = '';
        submissionError.value = '';
        return true;
    }
    function handleDiagnosisEnter() {
        const match = diagnosisMatches.value[diagnosisMatchIndex.value];
        if (diagnosisFocused.value && match) {
            selectDiagnosis(match.name);
            if (!match.detail) {
                commitDiagnosis();
            }
        } else {
            commitDiagnosis();
        }
    }
    function removeDiagnosis(index: number) {
        if (editingDiagnosisIndex.value === index) {
            editingDiagnosisIndex.value = null;
        } else if (editingDiagnosisIndex.value !== null && editingDiagnosisIndex.value > index) {
            editingDiagnosisIndex.value--;
        }
        diagnosis.value = diagnoses.value.filter((_, itemIndex) => itemIndex !== index).join('\n');
    }
    return {
        diagnosisDetailInput,
        diagnosisDetails,
        diagnosisMatchIndex,
        diagnosisFocused,
        diagnosisInput,
        editingDiagnosisIndex,
        editingDiagnosisValue,
        diagnosisEditError,
        diagnoses,
        pendingDiagnosis,
        diagnosisMatches,
        finishDiagnosisEdit,
        startDiagnosisEdit,
        cancelDiagnosisEdit,
        selectDiagnosis,
        commitDiagnosis,
        handleDiagnosisEnter,
        removeDiagnosis,
    };
}
