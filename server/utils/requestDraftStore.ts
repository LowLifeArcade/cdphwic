import type { RequestRecord, SessionUser } from '../../shared/domain';
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

export async function readRequestDraft(bucket: R2Bucket, environment: string, id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) return undefined;
    const object = await bucket.get(`${prefix(environment)}${id}.json`);
    return object ? object.json<RequestDraft>() : undefined;
}

export async function saveRequestDraft(bucket: R2Bucket, environment: string, user: SessionUser, input: {
    id?: number; form: DraftValues; prescriptionKey?: string; fileName?: string;
}) {
    const existing = input.id ? await readRequestDraft(bucket, environment, input.id) : undefined;
    if (input.id && (!existing || !canAccessDraft(existing, user))) throw new Error('Incomplete request not found.');
    if (input.prescriptionKey && !input.prescriptionKey.startsWith(`temporary/${environment}/`)) throw new Error('Invalid prescription upload.');
    const id = existing?.request.id ?? Number.parseInt(crypto.randomUUID().replaceAll('-', '').slice(0, 13), 16);
    const f = input.form;
    const draft: RequestDraft = {
        request: {
            id, status: 'incomplete',
            agencyId: existing?.request.agencyId ?? user.agencyId ?? 10,
            agencyMemberId: existing?.request.agencyMemberId ?? user.agencyMemberId ?? 100,
            participantName: `${f.patientFirstName || ''} ${f.patientLastName || ''}`.trim() || 'Unnamed participant',
            productName: String(f.formulaName || 'Formula not selected'),
            requestKind: f.requestKind === 'extension' ? 'extension' : 'new',
        },
        form: f,
        prescriptionKey: input.prescriptionKey ?? '',
        fileName: input.fileName ?? '',
    };
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
        for (const draft of records) if (draft && canAccessDraft(draft, user)) drafts.push(draft.request);
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return drafts;
}

export async function deleteRequestDraft(bucket: R2Bucket, environment: string, id: number) {
    await bucket.delete(`${prefix(environment)}${id}.json`);
}
