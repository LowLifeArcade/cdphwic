import { validateRequestSubmission } from '../../../shared/requestSubmission';
import { readRequestDraft, canAccessDraft, deleteRequestDraft } from '../../utils/requestDraftStore';
import { getSessionFromHeaders } from '../../utils/session';
import type { RequestRecord } from '../../../shared/domain';
import { normalizePhoneNumber } from '../../../shared/phone';
import { createRequestRecord, deleteRequestRecord, updateRequestRecord } from '../../utils/requestStore';
import {
    promoteTemporaryPrescriptionAttachment,
    storePrescriptionAttachment,
} from '../../utils/prescriptionStorage';

export default defineEventHandler(async (event) => {
    const parts = await readMultipartFormData(event);
    const requestPart = parts?.find((part) => part.name === 'request');
    const prescription = parts?.find((part) => part.name === 'prescription');
    const body = requestPart?.data
        ? (JSON.parse(new TextDecoder().decode(requestPart.data)) as Omit<RequestRecord, 'id'>)
        : await readBody<Omit<RequestRecord, 'id'>>(event);
    if (!body?.participantName || !body.productName || !body.agencyId || !body.agencyMemberId) {
        throw createError({ statusCode: 400, statusMessage: 'Participant, product, agency, and rep are required.' });
    }

    const { prescriptionKey, draftId, ...requestBody } = body as Omit<RequestRecord, 'id'> & { prescriptionKey?: string; draftId?: number };
    const validationError = validateRequestSubmission(requestBody);
    if (validationError) throw createError({ statusCode: 400, statusMessage: validationError });
    const environment = event.context.cloudflare?.env as Env | undefined;
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    if (draftId) {
        const draft = environment?.PRESCRIPTIONS ? await readRequestDraft(environment.PRESCRIPTIONS, environment.ENV, draftId) : undefined;
        if (!draft || !canAccessDraft(draft, user)) throw createError({ statusCode: 404, statusMessage: 'Incomplete request not found.' });
    }
    const finishDraft = async () => {
        if (draftId && environment?.PRESCRIPTIONS) await deleteRequestDraft(environment.PRESCRIPTIONS, environment.ENV, draftId);
    };
    const doctorOfficePhone = normalizePhoneNumber(requestBody.doctorOfficePhone ?? '');
    if (!doctorOfficePhone) {
        throw createError({ statusCode: 400, statusMessage: 'Enter a valid 10-digit doctor office phone number.' });
    }
    const request = createRequestRecord({
        ...requestBody,
        doctorOfficePhone,
        agencyId: user.agencyId ?? requestBody.agencyId,
        agencyMemberId: user.agencyMemberId ?? requestBody.agencyMemberId,
        status: 'unopened',
    });
    if (!prescription?.data && !prescriptionKey) {
        await finishDraft();
        return { request, demo: true };
    }

    if (!environment?.PRESCRIPTIONS) {
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 503, statusMessage: 'Prescription storage is unavailable.' });
    }

    let storedKey: string | undefined;
    let temporaryKey: string | undefined;
    let savedRequest: RequestRecord = request;
    try {
        const attachment = prescriptionKey
            ? await promoteTemporaryPrescriptionAttachment(environment.PRESCRIPTIONS, environment.ENV, request.id, prescriptionKey)
            : await storePrescriptionAttachment(environment.PRESCRIPTIONS, environment.ENV, request.id, prescription);
        storedKey = attachment.key;
        temporaryKey = 'sourceKey' in attachment ? attachment.sourceKey : undefined;
        await environment.CDPHWIC.prepare(
            `INSERT INTO request_attachments
                (request_id, attachment_type, file_name, storage_key_stub, content_type, file_size)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
            .bind(request.id, 'prescription', attachment.fileName, attachment.key, attachment.contentType, attachment.size)
            .run();
        if (temporaryKey) {
            await environment.PRESCRIPTIONS.delete(temporaryKey);
        }
        const updatedRequest = updateRequestRecord(request.id, {
            prescriptionAttachment: {
                storageKey: attachment.key,
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                size: attachment.size,
            },
        });
        savedRequest = updatedRequest ?? request;
    } catch (error) {
        if (storedKey) {
            await environment.PRESCRIPTIONS.delete(storedKey);
        }
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
    await finishDraft();
    return { request: savedRequest, demo: true };
});
