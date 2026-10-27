import { defineEventHandler, createError, readMultipartFormData } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
export default defineEventHandler(async (event) => {
    const { db, user, env } = surplusContext(event);
    if (user.role !== 'admin') throw createError({ statusCode: 403 });
    const parts = await readMultipartFormData(event);
    const file = parts?.find((p) => p.name === 'file');
    const kind = parts?.find((p) => p.name === 'kind')?.data.toString();
    if (
        !file?.data ||
        !['donation', 'destruction'].includes(kind ?? '') ||
        file.data.length > 10 * 1024 * 1024 ||
        file.data.subarray(0, 5).toString() !== '%PDF-'
    )
        throw createError({ statusCode: 400, statusMessage: 'Choose a PDF form of 10 MB or less.' });
    const id = crypto.randomUUID();
    const key = `${env.ENV}/surplus-forms/${id}.pdf`;
    await env.PRESCRIPTIONS.put(key, file.data, { httpMetadata: { contentType: 'application/pdf' } });
    try {
        await db
            .prepare('INSERT INTO surplus_forms(id,kind,file_name,storage_key,uploaded_by) VALUES(?,?,?,?,?)')
            .bind(id, kind, file.filename ?? 'form.pdf', key, user.id)
            .run();
    } catch (error) {
        await env.PRESCRIPTIONS.delete(key);
        throw error;
    }
    return { id };
});
