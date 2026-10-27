import { submittedRequest } from '../../../utils/submittedRequests';
import { getSessionFromHeaders } from '../../../utils/session';
import { canSeeAgency } from '../../../../shared/surplus';
import { canGenerateAuthorizationForm } from '../../../../shared/requestOperations';
import { getRequestById } from '../../../utils/requestStore';
import { SEED_AGENCIES, SEED_MEMBERS } from '../../../data/seed';
import { createAuthorizationFormPdf } from '../../../utils/authorizationForm';

export default defineEventHandler(async (event) => {
    const id = Number(event.context.params?.id);
    const user=getSessionFromHeaders({'x-demo-user':getHeader(event,'x-demo-user')});
    const env=event.context.cloudflare?.env as Partial<Env>|undefined;
    const request=(env?.CDPHWIC?await submittedRequest(env.CDPHWIC,id,user):undefined)??getRequestById(id);
    if (!request||!canSeeAgency(user,request.agencyId)) {
        throw createError({ statusCode: 404, statusMessage: 'Request not found.' });
    }
    if (!canGenerateAuthorizationForm(request)) {
        throw createError({ statusCode: 409, statusMessage: 'Authorization Form is available after approval and product ordering.' });
    }

    const agency = SEED_AGENCIES.find((item) => item.id === request.agencyId);
    const rep = SEED_MEMBERS.find((item) => item.id === request.agencyMemberId);
    const pdf = await createAuthorizationFormPdf(request, agency, rep);
    setResponseHeader(event, 'content-type', 'application/pdf');
    setResponseHeader(event, 'content-disposition', `attachment; filename="authorization-form-${request.id}.pdf"`);
    return pdf;
});
