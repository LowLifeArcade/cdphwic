import { expect, it, vi } from 'vitest';
import { useProductMutation } from '../app/features/products/composables/useProductMutation';

it('keeps busy set until completion and clears earlier errors before retrying', async () => {
    const mutation = useProductMutation();
    let finish!: () => void;
    const operation = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    mutation.error.value = 'Old error';
    const pending = mutation.run(operation, 'Failed');
    expect(mutation.saving.value).toBe(true);
    expect(mutation.error.value).toBe('');
    finish();
    expect(await pending).toBe(true);
    expect(mutation.saving.value).toBe(false);
});

it.each([
    [{ data: { statusMessage: 'Nested' }, statusMessage: 'Outer' }, 'Nested'],
    [{ statusMessage: 'Outer' }, 'Outer'],
    [new Error('Network'), 'Fallback'],
])('reports a failed operation and releases saving state', async (failure, message) => {
    const mutation = useProductMutation();
    expect(await mutation.run(async () => { throw failure; }, 'Fallback')).toBe(false);
    expect(mutation.error.value).toBe(message);
    expect(mutation.saving.value).toBe(false);
    expect(await mutation.run(async () => {}, 'Fallback')).toBe(true);
    expect(mutation.error.value).toBe('');
});
