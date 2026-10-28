import {normalizeClinic,type RequestShipping} from '../../shared/shipping';
import {requestAgency} from './requestAgency';
import {SEED_MEMBERS} from '../data/seed';
import type { ProductForm, RequestRecord, SessionUser } from '../../shared/domain';
import { filterRequestsByScope } from '../../shared/requestScope';

export type DraftValues = Record<string, string | number | boolean>;
export interface RequestDraft {
    request: RequestRecord;
    form: DraftValues;
    prescriptionKey: string;
    fileName: string;
}
const prefix = (environment: string) => `${environment}/request-drafts/`;

export function canAccessDraft(draft: RequestDraft, user: SessionUser) {
    return filterRequestsByScope([draft.request], user).length > 0;
}

function draftSummary(draft: RequestDraft): RequestRecord {
    const familyId = Number(draft.form.familyId);
    const form = draft.form.productForm;
    let shipping: RequestShipping | undefined;
    try {
        const value = JSON.parse(String(draft.form._shipping || 'null'));
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            shipping = {...normalizeClinic(value), attention: typeof value.attention === 'string' ? value.attention : '', ...(typeof value.clinicId === 'string' ? {clinicId:value.clinicId} : {})};
        }
    } catch { /* A malformed incomplete Shipping field must not hide the requests list. */ }

    return {
        ...draft.request,
        shipping,
        participantFamilyId: Number.isFinite(familyId) && familyId > 0 ? familyId : draft.request.participantFamilyId,
        productForm: ['powder','concentrate','ready-to-feed'].includes(String(form)) ? form as ProductForm : draft.request.productForm,
    };
}

export async function readRequestDraft(bucket: R2Bucket, environment: string, id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) return undefined;
    const object = await bucket.get(`${prefix(environment)}${id}.json`);
    return object ? object.json<RequestDraft>() : undefined;
}

export async function saveRequestDraft(bucket: R2Bucket, environment: string, user: SessionUser, input: {
    id?: number; agencyId?: number; agencyMemberId?:number; form: DraftValues; prescriptionKey?: string; fileName?: string;
}) {
    const existing = input.id ? await readRequestDraft(bucket, environment, input.id) : undefined;
    if (input.id && (!existing || !canAccessDraft(existing, user))) throw new Error('Incomplete request not found.');
    if (input.prescriptionKey && !input.prescriptionKey.startsWith(`temporary/${environment}/`)) throw new Error('Invalid prescription upload.');
    const agencyId=input.agencyId??existing?.request.agencyId??user.agencyId??10;
    const membership=requestAgency(user,agencyId,input.agencyMemberId??(existing?.request.agencyId===agencyId?existing.request.agencyMemberId:undefined)??SEED_MEMBERS.find(m=>m.agencyId===agencyId)?.id,true);
    const id = existing?.request.id ?? Number.parseInt(crypto.randomUUID().replaceAll('-', '').slice(0, 13), 16);
    const f = input.form;
    const draft: RequestDraft = {
        request: {
            id, status: 'incomplete',
            agencyId: membership.agencyId,
            agencyMemberId: membership.agencyMemberId,
            participantName: `${f.patientFirstName || ''} ${f.patientLastName || ''}`.trim() || 'Unnamed participant',
            productName: String(String(f.formulaName).trim().toLowerCase() === 'other' ? f.otherFormulaName || 'Other formula' : f.formulaName || 'Formula not selected'),
            requestKind: f.requestKind === 'extension' ? 'extension' : 'new',
        },
        form: f,
        prescriptionKey: input.prescriptionKey ?? '',
        fileName: input.fileName ?? '',
    };
    draft.request = draftSummary(draft);
    await bucket.put(`${prefix(environment)}${id}.json`, JSON.stringify(draft), { httpMetadata: { contentType: 'application/json' } });
    return draft;
}

export async function listRequestDrafts(bucket: R2Bucket, environment: string, user: SessionUser) {
    const drafts: RequestRecord[] = [];
    let cursor: string | undefined;
    do {
        const page = await bucket.list({ prefix: prefix(environment), cursor });
        const records = await Promise.all(page.objects.map(async (item) => {
            const object = await bucket.get(item.key);
            return object?.json<RequestDraft>();
        }));
        for (const draft of records) if (draft && canAccessDraft(draft, user)) drafts.push(draftSummary(draft));
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return drafts;
}

export async function deleteRequestDraft(bucket: R2Bucket, environment: string, id: number) {
    await bucket.delete(`${prefix(environment)}${id}.json`);
}

export async function deleteAccessibleRequestDraft(bucket: R2Bucket, environment: string, user: SessionUser, id: number) {
    const draft = await readRequestDraft(bucket, environment, id);
    if (!draft || draft.request.status !== 'incomplete' || !canAccessDraft(draft, user)) {
        throw Object.assign(new Error('Incomplete request not found.'), {statusCode:404});
    }
    await deleteRequestDraft(bucket, environment, id);
    if (draft.prescriptionKey.startsWith(`temporary/${environment}/`)) await bucket.delete(draft.prescriptionKey);
}
