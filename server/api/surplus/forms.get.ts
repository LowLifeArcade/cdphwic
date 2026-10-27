import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
export default defineEventHandler(async (event) => {
    const { db, env } = surplusContext(event);
    const kind = String(getQuery(event).kind);
    if (!['donation', 'destruction'].includes(kind)) throw createError({ statusCode: 400 });
    const f = await db
        .prepare('SELECT * FROM surplus_forms WHERE kind=? ORDER BY created_at DESC,rowid DESC LIMIT 1')
        .bind(kind)
        .first<any>();
    if (!f) throw createError({ statusCode: 404, statusMessage: 'This form has not been uploaded yet.' });
    const object = await env.PRESCRIPTIONS.get(f.storage_key);
    if (!object) throw createError({ statusCode: 404 });
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="Formula-${kind}-Form.pdf"`);
    setHeader(event, 'Cache-Control', 'private, no-store');
    return object.body;
});
