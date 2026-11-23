import {submittedRequests} from '../../utils/submittedRequests';
import {getRequestsForUser} from '../../utils/requestStore';
import {getSessionFromHeaders} from '../../utils/session';
import {filterRequestsByScope} from '../../../shared/requestScope';
import {participantRequestHistory} from '../../../shared/requestHistory';
export default defineEventHandler(async event => {
    const user = getSessionFromHeaders({'x-demo-user':getHeader(event,'x-demo-user')});
    const body = await readBody(event);
    if (!body || !['familyId','individualId','name','dob'].every(key=>typeof body[key] === 'string' && body[key].length <= 250))
        throw createError({statusCode:400,statusMessage:'Enter valid participant details.'});
    const env = event.context.cloudflare?.env as Partial<Env>|undefined;
    const durable = env?.CDPHWIC ? await submittedRequests(env.CDPHWIC,user) : [];
    const ids = new Set(durable.map(r=>r.id));
    const scoped = filterRequestsByScope([...durable,...getRequestsForUser(user,'all').filter(r=>!ids.has(r.id))],user,'all');
    const current = scoped.find(r=>r.id === Number(body.currentId));
    if (body.currentId && !current) throw createError({statusCode:404,statusMessage:'Request not found.'});
    return participantRequestHistory(scoped, current ? {
        familyId:String(current.participantFamilyId??''), individualId:current.wicIndividualId??'', name:current.participantName, dob:current.participantDob??'', currentId:current.id,before:current.submissionDate,
    } : {familyId:body.familyId,individualId:body.individualId,name:body.name,dob:body.dob});
});
