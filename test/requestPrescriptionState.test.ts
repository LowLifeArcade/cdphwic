import { effectScope } from 'vue';
import { expect, it, vi } from 'vitest';
import { usePrescriptionUpload } from '../app/features/requests/composables/usePrescriptionUpload';

function setup() {
    const parse = vi.fn(async (_file: File) => ({ message: 'Parsed', missing: ['DOB'], storageKey: 'key', extracted: {} }));
    const remove = vi.fn(async (_key: string) => {});
    const apply = vi.fn();
    const removeExisting = vi.fn();
    const scope = effectScope();
    const state = scope.run(() => usePrescriptionUpload({ parse, remove, apply, removeExisting }))!;
    return { scope, state, parse, remove, apply, removeExisting };
}
const file = () => new File(['pdf'], 'medical.pdf', { type: 'application/pdf' });

it('parses a selected file and publishes extraction feedback', async () => {
    const { state, parse, apply, scope } = setup();
    const selected = file();
    await state.selectPrescription(selected);
    expect(parse).toHaveBeenCalledWith(selected);
    expect(apply).toHaveBeenCalledWith({});
    expect(state.selectedPrescription.value).toBe(selected);
    expect(state.uploadedStorageKey.value).toBe('key');
    expect(state.parserMissing.value).toEqual(['DOB']);
    expect(state.parsing.value).toBe(false);
    scope.stop();
});
it('keeps the old file on cancellation and only replaces it after successful removal', async () => {
    const { state, parse, remove, removeExisting, scope } = setup();
    await state.selectPrescription(file());
    const old = state.selectedPrescription.value;
    const pending = state.selectPrescription(file());
    expect(state.removeConfirmationOpen.value).toBe(true);
    state.resolveRemoveConfirmation(false);
    await pending;
    expect(state.selectedPrescription.value).toBe(old);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    const replacement = state.selectPrescription(file());
    state.resolveRemoveConfirmation(true);
    await replacement;
    expect(remove).toHaveBeenCalledWith('key');
    expect(removeExisting).toHaveBeenCalledOnce();
    expect(parse).toHaveBeenCalledTimes(2);
    scope.stop();
});
it('retains the upload and exposes removal failure without parsing a replacement', async () => {
    const { state, remove, parse, scope } = setup();
    await state.selectPrescription(file());
    remove.mockRejectedValueOnce({ statusMessage: 'Storage unavailable' });
    const pending = state.selectPrescription(file());
    state.resolveRemoveConfirmation(true);
    await pending;
    expect(state.parserError.value).toBe('Storage unavailable');
    expect(state.uploadedStorageKey.value).toBe('key');
    expect(parse).toHaveBeenCalledTimes(1);
    scope.stop();
});
it('releases parsing state on errors and cancels pending confirmation on disposal', async () => {
    const { state, parse, remove, scope } = setup();
    parse.mockRejectedValueOnce({ statusMessage: 'Cannot read file' });
    await state.selectPrescription(file());
    expect(state.parserError.value).toBe('Cannot read file');
    expect(state.parsing.value).toBe(false);
    const pending = state.removePrescription();
    scope.stop();
    expect(await pending).toBe(false);
    expect(remove).not.toHaveBeenCalled();
});

it('does not apply a parse after disposal and removes its otherwise orphaned temporary upload', async () => {
    const { state, parse, remove, apply, scope } = setup();
    let finish!: (value: Awaited<ReturnType<typeof parse>>) => void;
    parse.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = state.selectPrescription(file());
    expect(state.parsing.value).toBe(true);
    scope.stop();
    finish({ message: 'Parsed', missing: [], storageKey: 'late-upload', extracted: {} });
    await pending;
    expect(apply).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('late-upload');
    expect(state.uploadedStorageKey.value).toBe('');
    expect(state.parsing.value).toBe(false);
});
