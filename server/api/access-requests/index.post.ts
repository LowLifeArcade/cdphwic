import { validateAccessRequest } from '../../../shared/accessFlow';
import { createAccessRequest } from '../../utils/accessStore';

export default defineEventHandler(async (event) => {
    const body = await readBody<{
        name?: string;
        email?: string;
        localAgencyName?: string;
        staffId?: string;
        note?: string;
        requestedMemberType?: 'agency' | 'internal';
    }>(event);
    const fieldErrors = validateAccessRequest(body ?? {});
    if (!body?.localAgencyName?.trim() && !body?.staffId?.trim()) {
        fieldErrors.identifier = 'Enter a local agency name or staff ID.';
    }

    if (Object.keys(fieldErrors).length) {
        throw createError({ statusCode: 400, statusMessage: JSON.stringify(fieldErrors) });
    }

    return {
        request: createAccessRequest({
            name: body.name!.trim(),
            email: body.email!.trim(),
            localAgencyName: body.localAgencyName?.trim(),
            staffId: body.staffId?.trim(),
            note: body.note!.trim(),
            requestedMemberType: body.requestedMemberType ?? 'agency',
        }),
    };
});
