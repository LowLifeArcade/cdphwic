import { createError, type H3Event } from 'h3';
export function productDatabase(event: H3Event): D1Database {
    const db = (event.context.cloudflare?.env as { CDPHWIC?: D1Database } | undefined)?.CDPHWIC;
    if (!db) throw createError({ statusCode: 503, statusMessage: 'Product database unavailable. Products require the CDPHWIC D1 binding.' });
    return db;
}
