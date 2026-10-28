import type { RequestRecord } from '../../../shared/domain';
import { getRequestById, updateRequestRecord } from '../../utils/requestStore';
import { submittedRequest, ensureSubmittedRequest, updateSubmittedRequest } from '../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../utils/session';
import { canSeeAgency, isReviewer } from '../../../shared/surplus';
import { submissionFields } from '../../../shared/requestEditing';
export default defineEventHandler(async (event) => {
    const id = Number(getRouterParam(event, 'id'));
    const updates = await readBody<Partial<RequestRecord> & {sendEtaShipmentIndex?:number}>(event);
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    if (!env?.CDPHWIC) throw createError({ statusCode: 503, statusMessage: 'Request database unavailable.' });
    const saved = await submittedRequest(env.CDPHWIC, id, user);
    const raw = saved ?? getRequestById(id);
    if (!raw || !canSeeAgency(user, raw.agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    const previous = saved ?? (await ensureSubmittedRequest(env.CDPHWIC, raw));
    const changesForm = Object.entries(submissionFields(updates)).some(
        ([key, value]) => JSON.stringify(key === 'surplusItems' ? value ?? [] : value) !== JSON.stringify(key === 'surplusItems' ? previous.surplusItems ?? [] : previous[key as keyof RequestRecord]),
    );
    if (!isReviewer(user) && changesForm)
        throw createError({
            statusCode: 409,
            statusMessage: 'Use Edit submission to update the complete form before Admin/FPU opens it.',
        });
    const { prescriptionAttachment, openedAt, revision, sendEtaShipmentIndex, ...safe } = updates;
    if (sendEtaShipmentIndex !== undefined && !isReviewer(user)) throw createError({statusCode:403,statusMessage:'Only Admin or CDPH/WIC can send shipment ETAs.'});
    const request = await updateSubmittedRequest(env.CDPHWIC, previous, safe, !isReviewer(user) && changesForm, sendEtaShipmentIndex);
    updateRequestRecord(id, request);
    return { request, demo: true };
});
