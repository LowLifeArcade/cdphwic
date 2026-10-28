import { describe, expect, it } from 'vitest';
import { saveRequestDraft, readRequestDraft, listRequestDrafts, deleteRequestDraft, deleteAccessibleRequestDraft } from '../server/utils/requestDraftStore';
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

it('deletes only accessible incomplete requests and their temporary upload', async () => {
 const bucket=storage(); const user=getDemoUser('agency');
 const draft=await saveRequestDraft(bucket,'dev',user,{form:{},prescriptionKey:'temporary/dev/draft.pdf'});
 await bucket.put('temporary/dev/draft.pdf','file');
 await expect(deleteAccessibleRequestDraft(bucket,'dev',{...user,agencyId:99},draft.request.id)).rejects.toThrow('not found');
 expect(await readRequestDraft(bucket,'dev',draft.request.id)).toBeTruthy();
 await deleteAccessibleRequestDraft(bucket,'dev',user,draft.request.id);
 expect(await readRequestDraft(bucket,'dev',draft.request.id)).toBeUndefined();
 expect(await bucket.get('temporary/dev/draft.pdf')).toBeNull();
 await expect(deleteAccessibleRequestDraft(bucket,'dev',user,123)).rejects.toThrow('not found');
});

it('includes the saved Family ID and formula form in incomplete request list rows',async()=>{
 const bucket=storage(); const user=getDemoUser('agency');
 await saveRequestDraft(bucket,'dev',user,{form:{familyId:'98765',formulaName:'Nutramigen',productForm:'concentrate'}});
 const rows=await listRequestDrafts(bucket,'dev',user);
 expect(rows[0]?.participantFamilyId).toBe(98765);
 expect(rows[0]?.productForm).toBe('concentrate');
});
it('allows Admin to move an incomplete draft to an agency without representatives',async()=>{
 const bucket=storage();const user=getDemoUser('admin');
 const draft=await saveRequestDraft(bucket,'dev',user,{agencyId:10,agencyMemberId:100,form:{}});
 const moved=await saveRequestDraft(bucket,'dev',user,{id:draft.request.id,agencyId:12,form:{}});
 expect(moved.request).toMatchObject({agencyId:12,agencyMemberId:0,status:'incomplete'});
});
it('uses saved Shipping for Clinic list rows and clears it when the draft is cleared',async()=>{
 const bucket=storage();const user=getDemoUser('agency');
 const shipping={clinicName:'Saved Clinic',addressLine1:'456 Clinic St',addressLine2:'Suite 2',city:'Ukiah',state:'CA',postalCode:'95482',attention:'Maria'};
 const draft=await saveRequestDraft(bucket,'dev',user,{form:{_shipping:JSON.stringify(shipping)}});
 expect((await listRequestDrafts(bucket,'dev',user))[0]?.shipping).toEqual(shipping);
 await saveRequestDraft(bucket,'dev',user,{id:draft.request.id,form:{_shipping:''}});
 expect((await listRequestDrafts(bucket,'dev',user))[0]?.shipping).toBeUndefined();
 await saveRequestDraft(bucket,'dev',user,{id:draft.request.id,form:{_shipping:'invalid JSON'}});
 expect((await listRequestDrafts(bucket,'dev',user))[0]?.shipping).toBeUndefined();
});
