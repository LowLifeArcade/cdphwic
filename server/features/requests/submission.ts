import type { RequestRecord, SessionUser } from '../../../shared/domain';
import { resolveSurplusClinic } from '../../utils/surplusClinicLocations';
import { shippingContact } from '../../../shared/shipping';
import { requestContact } from '../../utils/requestAgency';
import { listProducts } from '../../utils/productRepository';
import { resolveShipping } from '../../utils/clinicStore';
import {
    canEditSubmission,
    hasPendingMoreInfo,
    latestMoreInfoRequest,
    submissionFields,
} from '../../../shared/requestEditing';
import { validateRequestSubmission } from '../../../shared/requestSubmission';
import { validDate, localDate } from '../../../shared/surplus';
import { canSeeAgency } from '../../../shared/surplus';
import { conflict, nextRecord, writeRecord } from './persistence';
export async function editSubmittedRequest(
    db: D1Database,
    user: SessionUser,
    previous: RequestRecord,
    updates: Partial<RequestRecord>,
    expectedRevision: number,
    options: {
        attachment?: RequestRecord['prescriptionAttachment'] | null;
        statements?: D1PreparedStatement[];
        saveOnly?: boolean;
    } = {},
) {
    if (!canSeeAgency(user, previous.agencyId)) {
        throw Object.assign(new Error('Request not found.'), {
            statusCode: 404,
        });
    }
    if (
        !canEditSubmission(previous) ||
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision !== (previous.revision ?? 0)
    ) {
        throw conflict();
    }
    const request = nextRecord(previous, submissionFields(updates));
    if (request.shipping) {
        request.shipping = {
            ...request.shipping,
            ...shippingContact(request.shipping, requestContact(user, previous.agencyId, previous.agencyMemberId)),
        };
    }
    if (options.attachment !== undefined) {
        request.prescriptionAttachment = options.attachment ?? undefined;
    }
    if (!options.saveOnly || request.shipping?.clinicId) {
        request.shipping = await resolveShipping(db, user, previous.agencyId, request.shipping, previous.shipping);
    }
    const validation = options.saveOnly ? '' : validateRequestSubmission(request, await listProducts(db));
    if (validation) {
        throw Object.assign(new Error(validation), {
            statusCode: 400,
            statusMessage: validation,
        });
    }
    const rows = (r: RequestRecord) =>
        JSON.stringify(
            (r.surplusItems ?? []).map((e) => [
                e.productName,
                e.productForm ?? '',
                e.flavor ?? '',
                e.units,
                e.expirationDate ?? '',
                e.clinicId ?? '',
            ]),
        );
    const steps: D1PreparedStatement[] = [...(options.statements ?? [])];
    const originalSurplus = hasPendingMoreInfo(previous)
        ? latestMoreInfoRequest(previous)?.originalSurplusItems
        : previous.surplusItems;
    if (
        !options.saveOnly &&
        rows({
            ...previous,
            surplusItems: originalSurplus,
        }) !== rows(request)
    ) {
        steps.push(
            db
                .prepare(
                    "INSERT INTO surplus_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM surplus_reports WHERE submission_id=? AND status NOT IN ('pending','superseded')) THEN 1 ELSE 0 END",
                )
                .bind(previous.submissionId),
        );
        steps.push(
            db
                .prepare("UPDATE surplus_reports SET status='superseded' WHERE submission_id=? AND status='pending'")
                .bind(previous.submissionId),
        );
        for (const [index, row] of (request.surplusItems ?? []).entries()) {
            if (row.expirationDate && !validDate(row.expirationDate)) {
                throw conflict('Enter a valid surplus expiration date.');
            }
            const clinic = await resolveSurplusClinic(db, previous.agencyId, row.clinicId);
            const id = `${previous.submissionId}:edit:${request.revision}:${index}`;
            steps.push(
                db
                    .prepare(
                        'INSERT INTO surplus_reports(id,submission_id,row_id,agency_id,formula_name,form,flavor,expiration_date,reported_units,request_ref,reporter_id,counted_at,confirmer_name,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    )
                    .bind(
                        id,
                        previous.submissionId,
                        `edit:${request.revision}:${index}`,
                        previous.agencyId,
                        row.productName.trim().replace(/\s+/g, ' '),
                        row.productForm,
                        (row.flavor ?? '').trim().replace(/\s+/g, ' '),
                        row.expirationDate ?? '',
                        row.units,
                        previous.submissionId,
                        user.id,
                        localDate(),
                        user.name,
                        clinic.clinicId ?? null,
                        clinic.clinicName ?? null,
                        clinic.clinicAddress ? JSON.stringify(clinic.clinicAddress) : null,
                    ),
            );
        }
    }
    if (hasPendingMoreInfo(previous) && !options.saveOnly) {
        request.status = 'unopened';
        request.openedAt = undefined;
        request.moreInfoRequests = previous.moreInfoRequests!.map((entry) =>
            entry.id === latestMoreInfoRequest(previous)?.id
                ? {
                      ...entry,
                      resubmissionOpen: false,
                      resubmittedAt: new Date().toISOString(),
                      resubmittedBy: user.id,
                  }
                : entry,
        );
    }
    return writeRecord(db, previous, request, !hasPendingMoreInfo(previous), steps);
}
