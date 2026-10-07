import type { SignupCompletionInput } from '../../../shared/accessFlow';
import { completeSignup } from '../../../utils/accessStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<SignupCompletionInput>(event);
    try {
        return completeSignup(body);
    } catch (error) {
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
