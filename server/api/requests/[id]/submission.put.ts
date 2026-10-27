import { getRequestById, updateRequestRecord } from '../../../utils/requestStore';
import { submittedRequest, ensureSubmittedRequest, editSubmittedRequest } from '../../../utils/submittedRequests';
import { surplusContext } from '../../../utils/surplusContext';
import { canSeeAgency, isReviewer } from '../../../../shared/surplus';
import { submissionFieldKeys } from '../../../../shared/requestEditing';
import { promoteTemporaryPrescriptionAttachment } from '../../../utils/prescriptionStorage';
export default defineEventHandler(async (event) => {
    const { db, user, env } = surplusContext(event);
    if (isReviewer(user)) throw createError({statusCode:403,statusMessage:'Use the request review screen to update this submission.'});
    const id = Number(getRouterParam(event, 'id'));
    const parts = await readMultipartFormData(event);
    const part = parts?.find((p) => p.name === 'request');
    const body = part ? JSON.parse(new TextDecoder().decode(part.data)) : await readBody(event);
    const saved = await submittedRequest(db, id, user);
    const raw = saved ?? getRequestById(id);
    if (!raw || !canSeeAgency(user, raw.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    const previous = saved ?? (await ensureSubmittedRequest(db, raw));
    const fields = Object.fromEntries(submissionFieldKeys.map((key) => [key, body[key]]));
    let promoted: Awaited<ReturnType<typeof promoteTemporaryPrescriptionAttachment>> | undefined;
    try {
        if (body.prescriptionKey)
            promoted = await promoteTemporaryPrescriptionAttachment(
                env.PRESCRIPTIONS,
                env.ENV,
                id,
                body.prescriptionKey,
            );
        const attachment = promoted
            ? {
                  storageKey: promoted.key,
                  fileName: promoted.fileName,
                  contentType: promoted.contentType,
                  size: promoted.size,
              }
            : body.removePrescriptionAttachment
              ? null
              : undefined;
        const statements = promoted
            ? [
                  db
                      .prepare(
                          'INSERT INTO request_attachments(request_id,attachment_type,file_name,storage_key_stub,content_type,file_size) VALUES(?,?,?,?,?,?)',
                      )
                      .bind(id, 'prescription', promoted.fileName, promoted.key, promoted.contentType, promoted.size),
              ]
            : [];
        const request = await editSubmittedRequest(db, user, previous, fields, body.revision, {
            attachment,
            statements,
        });
        updateRequestRecord(id, request);
        if (promoted?.sourceKey) {
            try {
                await env.PRESCRIPTIONS.delete(promoted.sourceKey);
            } catch {
                console.warn('Saved edited request; temporary attachment cleanup deferred.');
            }
        }
        return { request };
    } catch (error) {
        if (promoted) await env.PRESCRIPTIONS.delete(promoted.key);
        throw error;
    }
});
