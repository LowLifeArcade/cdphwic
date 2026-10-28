import { createError, getHeader, getRouterParam, type H3Event } from 'h3';
import { getSessionFromHeaders } from './session';
import { SEED_AGENCIES } from '../data/seed';
import { clinicAccess } from './clinicStore';
export function clinicContext(event: H3Event, write = false) {
    const agencyId = Number(getRouterParam(event, 'id'));
    const user = getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') });
    clinicAccess(user, agencyId, write);
    if (!SEED_AGENCIES.some((a) => a.id === agencyId))
        throw createError({ statusCode: 404, statusMessage: 'Agency not found.' });
    const db = event.context.cloudflare?.env?.CDPHWIC as D1Database | undefined;
    if (!db) throw createError({ statusCode: 503, statusMessage: 'Clinic address book unavailable.' });
    return { db, user, agencyId };
}
