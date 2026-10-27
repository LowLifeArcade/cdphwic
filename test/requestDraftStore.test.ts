import { describe, expect, it } from 'vitest';
import { saveRequestDraft, readRequestDraft, listRequestDrafts, deleteRequestDraft } from '../server/utils/requestDraftStore';
import { getDemoUser } from '../server/utils/session';

function storage() {
    const objects = new Map<string, string>();
    const bucket = {
        put: async (key: string, value: string) => { objects.set(key, value); },
        get: async (key: string) => objects.has(key) ? { json: async () => JSON.parse(objects.get(key)!) } : null,
        list: async ({ prefix }: { prefix: string }) => ({ objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
        delete: async (key: string) => { objects.delete(key); },
    } as unknown as R2Bucket;
    return bucket;
}

describe('durable incomplete requests', () => {
    it('saves an empty form, lists it as incomplete, and reopens every partial value and upload', async () => {
        const bucket = storage();
        const user = getDemoUser('admin');
        const draft = await saveRequestDraft(bucket, 'dev', user, { form: { patientFirstName: '', formulaName: '' } });
        expect(draft.request.status).toBe('incomplete');
        expect(await listRequestDrafts(bucket, 'dev', user)).toEqual([draft.request]);
        const updated = await saveRequestDraft(bucket, 'dev', user, {
            id: draft.request.id, form: { patientFirstName: 'Ana', formulaName: 'Fortini', wicStaffFoodRestrictions: 'restricted', _diagnosisInput: 'Food allergy', _diagnosisDetails: 'Peanut', _additionalFormulas: JSON.stringify([{ formulaName: 'Fortini', productForm: 'ready-to-feed', ouncesPrescribed: '12' }]), _requestedMonths: JSON.stringify(['01', '03']), _surplusEntries: JSON.stringify([{ productName: 'Fortini', productForm: 'ready-to-feed', flavor: '', units: '3', expirationDate: '2027-01-01' }]) },
            prescriptionKey: 'temporary/dev/example.pdf', fileName: 'example.pdf',
        });
        expect(updated.request.id).toBe(draft.request.id);
        expect(await readRequestDraft(bucket, 'dev', draft.request.id)).toEqual(updated);
        expect(await listRequestDrafts(bucket, 'dev', user)).toHaveLength(1);
        await deleteRequestDraft(bucket, 'dev', draft.request.id);
        expect(await listRequestDrafts(bucket, 'dev', user)).toEqual([]);
    });
    it('isolates environments and agency access and rejects overwriting someone else’s request', async () => {
        const bucket = storage();
        const user = { ...getDemoUser('agency'), agencyId: 10, agencyMemberId: 100 };
        const other = { ...user, agencyId: 20, agencyMemberId: 200 };
        const draft = await saveRequestDraft(bucket, 'dev', user, { form: {} });
        expect(await listRequestDrafts(bucket, 'prod', user)).toEqual([]);
        expect(await listRequestDrafts(bucket, 'dev', other)).toEqual([]);
        await expect(saveRequestDraft(bucket, 'dev', other, { id: draft.request.id, form: {} })).rejects.toThrow('not found');
        await expect(saveRequestDraft(bucket, 'dev', user, { form: {}, prescriptionKey: 'prod/requests/1/file.pdf' })).rejects.toThrow('Invalid');
    });
});
