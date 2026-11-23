import { ref } from 'vue';

/** Product action state; pages retain ownership of HTTP payloads and navigation. */
export function useProductMutation(initialError = '') {
    const error = ref(initialError);
    const saving = ref(false);
    async function run(operation: () => Promise<unknown>, fallback: string, nestedErrors = true): Promise<boolean> {
        error.value = '';
        saving.value = true;
        try {
            await operation();
            return true;
        } catch (requestError) {
            const failure = requestError as {
                data?: {
                    statusMessage?: string;
                };
                statusMessage?: string;
            };
            error.value =
                (nestedErrors ? failure?.data?.statusMessage : undefined) ?? failure?.statusMessage ?? fallback;
            return false;
        } finally {
            saving.value = false;
        }
    }
    return {
        error,
        saving,
        run,
    };
}
