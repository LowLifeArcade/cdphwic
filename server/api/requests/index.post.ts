import { hasMedicalDocumentation, medicalDocumentationRequiredMessage } from '../../../shared/medicalDocumentation';
import {requestAgency} from '../../utils/requestAgency';
import {resolveShipping} from '../../utils/clinicStore';
import { persistSurplusSubmission } from '../../utils/surplusReports';
import { validateRequestSubmission } from '../../../shared/requestSubmission';
import { readRequestDraft, canAccessDraft, deleteRequestDraft } from '../../utils/requestDraftStore';
import { getSessionFromHeaders } from '../../utils/session';
import type { RequestRecord } from '../../../shared/domain';
import { normalizePhoneNumber } from '../../../shared/phone';
import { createRequestRecord, deleteRequestRecord, updateRequestRecord } from '../../utils/requestStore';
import { promoteTemporaryPrescriptionAttachment, storePrescriptionAttachment } from '../../utils/prescriptionStorage';

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

    const { prescriptionKey, draftId, ...requestBody } = body as Omit<RequestRecord, 'id'> & {
        prescriptionKey?: string;
        draftId?: number;
    };
    const validationError = validateRequestSubmission(requestBody);
    if (validationError) throw createError({ statusCode: 400, statusMessage: validationError });
    const environment = event.context.cloudflare?.env as Partial<Env> | undefined;
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const membership=requestAgency(user,requestBody.agencyId,requestBody.agencyMemberId);
    const submissionId = body.submissionId ?? crypto.randomUUID();
    const submissionPayload = JSON.stringify(requestBody);
    if (!environment?.CDPHWIC) throw createError({ statusCode: 503, statusMessage: 'Request database unavailable.' });
    const previous = await environment.CDPHWIC.prepare(
        'SELECT request_json,agency_id,payload,actor_id FROM surplus_submissions WHERE id=?',
    )
        .bind(submissionId)
        .first<{ request_json: string; agency_id: number; payload: string; actor_id: number }>();
    if (previous) {
        if (previous.actor_id !== user.id || previous.payload !== submissionPayload)
            throw createError({
                statusCode: 409,
                statusMessage: 'Submission reference already used. Reload the saved request.',
            });
        if(draftId&&environment.PRESCRIPTIONS){
            const draft=await readRequestDraft(environment.PRESCRIPTIONS,environment.ENV??'prod',draftId);
            if(draft&&canAccessDraft(draft,user))await deleteRequestDraft(environment.PRESCRIPTIONS,environment.ENV??'prod',draftId);
        }
        return { request: JSON.parse(previous.request_json), demo: true };
    }
    if (!hasMedicalDocumentation({temporaryKey: prescriptionKey, fileSize: prescription?.data?.length}))
        throw createError({statusCode:400,statusMessage:medicalDocumentationRequiredMessage});
    if (draftId) {
        const draft = environment?.PRESCRIPTIONS
            ? await readRequestDraft(environment.PRESCRIPTIONS, environment.ENV, draftId)
            : undefined;
        if (!draft || !canAccessDraft(draft, user))
            throw createError({ statusCode: 404, statusMessage: 'Incomplete request not found.' });
    }
    const finishDraft = async () => {
        if (draftId && environment?.PRESCRIPTIONS)
            await deleteRequestDraft(environment.PRESCRIPTIONS, environment.ENV, draftId);
    };
    requestBody.shipping=await resolveShipping(environment.CDPHWIC,user,user.agencyId??requestBody.agencyId,requestBody.shipping);
    const doctorOfficePhone = normalizePhoneNumber(requestBody.doctorOfficePhone ?? '');
    if (!doctorOfficePhone) {
        throw createError({ statusCode: 400, statusMessage: 'Enter a valid 10-digit doctor office phone number.' });
    }
    const sequence = await environment.CDPHWIC.prepare(
        'INSERT INTO surplus_request_ids DEFAULT VALUES RETURNING id',
    ).first<number>('id');
    if (!sequence) throw createError({ statusCode: 503, statusMessage: 'Could not allocate request ID.' });
    const request = createRequestRecord(
        {
            ...requestBody,
            submissionId,
            doctorOfficePhone,
            agencyId: membership.agencyId,
            agencyMemberId: membership.agencyMemberId,
            status: 'unopened',
        },
        1000000 + sequence,
    );

    if (!environment?.PRESCRIPTIONS) {
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 503, statusMessage: 'Prescription storage is unavailable.' });
    }

    let storedKey: string | undefined;
    let temporaryKey: string | undefined;
    let savedRequest: RequestRecord = request;
    try {
        const attachment = prescriptionKey
            ? await promoteTemporaryPrescriptionAttachment(
                  environment.PRESCRIPTIONS,
                  environment.ENV,
                  request.id,
                  prescriptionKey,
              )
            : await storePrescriptionAttachment(environment.PRESCRIPTIONS, environment.ENV, request.id, prescription!);
        storedKey = attachment.key;
        temporaryKey = 'sourceKey' in attachment && typeof attachment.sourceKey==='string' ? attachment.sourceKey : undefined;
        await environment.CDPHWIC.prepare(
            `INSERT INTO request_attachments
                (request_id, attachment_type, file_name, storage_key_stub, content_type, file_size)
             VALUES (?, ?, ?, ?, ?, ?)`,
        )
            .bind(
                request.id,
                'prescription',
                attachment.fileName,
                attachment.key,
                attachment.contentType,
                attachment.size,
            )
            .run();

        const updatedRequest = updateRequestRecord(request.id, {
            prescriptionAttachment: {
                storageKey: attachment.key,
                fileName: attachment.fileName,
                contentType: attachment.contentType,
                size: attachment.size,
            },
        });
        savedRequest = await persistSurplusSubmission(
            environment.CDPHWIC,
            submissionId,
            updatedRequest ?? request,
            user,
            submissionPayload,
        );
    } catch (error) {
        if (storedKey) {
            await environment.PRESCRIPTIONS.delete(storedKey);
        }
        await environment.CDPHWIC.prepare('DELETE FROM request_attachments WHERE request_id=?').bind(request.id).run();
        deleteRequestRecord(request.id);
        throw createError({ statusCode: 400, statusMessage: (error as Error).message });
    }
    if (savedRequest.id !== request.id) {
        if (storedKey) await environment.PRESCRIPTIONS.delete(storedKey);
        await environment.CDPHWIC.prepare('DELETE FROM request_attachments WHERE request_id=?').bind(request.id).run();
        deleteRequestRecord(request.id);
    }
    if (temporaryKey) await environment.PRESCRIPTIONS.delete(temporaryKey);
    await finishDraft();
    return { request: savedRequest, demo: true };
});
