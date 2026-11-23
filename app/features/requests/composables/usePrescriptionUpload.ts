import { onScopeDispose, ref } from 'vue';
import type { ProductForm } from '#shared/domain';
import type { FormulaEntry } from '#shared/formulaEntries';
export type PrescriptionParseResult = {
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
};
interface PrescriptionUploadOptions {
    parse: (file: File) => Promise<PrescriptionParseResult>;
    remove: (key: string) => Promise<unknown>;
    apply: (fields: PrescriptionParseResult['extracted']) => void;
    removeExisting: () => void;
}
export function usePrescriptionUpload(options: PrescriptionUploadOptions) {
    let disposed = false;
    const parsing = ref(false);
    const parserMessage = ref('');
    const parserError = ref('');
    const parserMissing = ref<string[]>([]);
    const selectedPrescription = ref<File | null>(null);
    const uploadedStorageKey = ref('');
    const removeConfirmationOpen = ref(false);
    let removeConfirmationResolver: ((confirmed: boolean) => void) | undefined;
    const fileInput = ref<HTMLInputElement>();
    async function processPrescription(file: File) {
        parserError.value = '';
        parserMessage.value = '';
        parserMissing.value = [];
        parsing.value = true;
        try {
            const result = await options.parse(file);
            if (disposed) {
                // The form cannot save this upload after closing. Do not apply fields to its stale draft.
                if (result.storageKey) {
                    await options.remove(result.storageKey);
                }

                return;
            }

            options.apply(result.extracted);
            parserMessage.value = result.message;
            parserMissing.value = result.missing;
            uploadedStorageKey.value = result.storageKey;
        } catch (requestError) {
            parserError.value =
                (
                    requestError as {
                        statusMessage?: string;
                    }
                ).statusMessage ?? 'Prescription could not be read.';
        } finally {
            parsing.value = false;
        }
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
                await options.remove(uploadedStorageKey.value);
            }
            options.removeExisting();
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
                (
                    requestError as {
                        statusMessage?: string;
                    }
                ).statusMessage ?? 'The prescription could not be removed.';
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
    onScopeDispose(() => {
        disposed = true;
        resolveRemoveConfirmation(false);
    });
    return {
        parsing,
        parserMessage,
        parserError,
        parserMissing,
        selectedPrescription,
        uploadedStorageKey,
        removeConfirmationOpen,
        fileInput,
        resolveRemoveConfirmation,
        removePrescription,
        selectPrescription,
        handleFileSelection,
        handleDrop,
    };
}
