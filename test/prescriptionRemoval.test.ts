import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body);
vi.stubGlobal('createError', (details: object) => Object.assign(new Error('Request rejected'), details));

// This route uses POST: Nitro's Cloudflare adapter forwards bodies for POST,
// but discards DELETE bodies before readBody can consume them.
const { default: removeUpload } = await import('../server/api/requests/prescription-upload/remove.post');

describe('temporary upload removal', () => {
    it('deletes the selected temporary upload and permits retrying removal', async () => {
        const deleteObject = vi.fn().mockResolvedValue(undefined);
        const event = { body: { key: 'temporary/dev/test-file.pdf' }, context: { cloudflare: { env: { ENV: 'dev', PRESCRIPTIONS: { delete: deleteObject } } } } };
        await expect(removeUpload(event as never)).resolves.toEqual({ deleted: true });
        await expect(removeUpload(event as never)).resolves.toEqual({ deleted: true });
        expect(deleteObject).toHaveBeenCalledWith('temporary/dev/test-file.pdf');
    });
    it('rejects permanent uploads and keys from another environment', async () => {
        const deleteObject = vi.fn();
        for (const key of ['prod/requests/1/file.pdf', 'temporary/prod/file.pdf', '']) {
            const event = { body: { key }, context: { cloudflare: { env: { ENV: 'dev', PRESCRIPTIONS: { delete: deleteObject } } } } };
            await expect(removeUpload(event as never)).rejects.toMatchObject({ statusCode: 400 });
        }
        expect(deleteObject).not.toHaveBeenCalled();
    });
});
