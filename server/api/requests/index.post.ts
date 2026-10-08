import type { RequestRecord } from '../../../shared/domain';
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

    const { prescriptionKey, ...requestBody } = body as Omit<RequestRecord, 'id'> & { prescriptionKey?: string };
    const request = createRequestRecord({ ...requestBody, status: requestBody.status ?? 'pending' });
    if (!prescription?.data && !prescriptionKey) {
        return { request, demo: true };
    }

    const environment = event.context.cloudflare?.env as Env | undefined;
    if (!environment?.PRESCRIPTIONS) {
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 503, statusMessage: 'Prescription storage is unavailable.' });
    }

    let storedKey: string | undefined;
    let temporaryKey: string | undefined;
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
        return { request: updatedRequest ?? request, demo: true };
    } catch (error) {
        if (storedKey) {
            await environment.PRESCRIPTIONS.delete(storedKey);
        }
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
});
