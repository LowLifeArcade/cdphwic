import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive, ref } from 'vue';
import { useRequestConversationSync } from '../app/features/requests/composables/useRequestConversationSync';
import type { RequestRecord } from '../shared/domain';

const record = (updates: Partial<RequestRecord> = {}): RequestRecord => ({ id: 1, agencyId: 10, agencyMemberId: 100, participantName: 'Synthetic', productName: 'Fortini', status: 'opened', revision: 1, ...updates });
function setup() {
    vi.useFakeTimers();
    const focus = new EventTarget();
    vi.stubGlobal('window', focus);
    vi.stubGlobal('document', { hidden: false });
    const current = ref<RequestRecord | null>(record());
    const identity = ref('admin');
    const draft = reactive<Partial<RequestRecord>>(record());
    const protectedDraft = ref(false);
    const load = vi.fn(async () => record({ revision: 2 }));
    const markRead = vi.fn(async () => record({ revision: 2 }));
    const changed = vi.fn(); const error = vi.fn(); const reset = vi.fn();
    const scope = effectScope();
    const state = scope.run(() => useRequestConversationSync({ request: () => current.value, identity, draft, copyRequest: value => JSON.parse(JSON.stringify(value)), hasProtectedDraft: () => protectedDraft.value, load, markRead, changed, error, reset }))!;
    return { state, current, identity, draft, protectedDraft, load, markRead, changed, error, reset, scope, focus };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('merges message-only updates without overwriting unsaved fields, and rejects changed nonmessage fields', () => {
    const f = setup(); f.protectedDraft.value = true; f.draft.participantName = 'Unsaved edit';
    const note = { id: 'note', notes: 'Question', requestedAt: '2026-11-01', requestedBy: 1 };
    expect(f.state.mergeMessageReadResult(record({ revision: 2, moreInfoRequests: [note] }), 'admin')).toBe(true);
    expect(f.draft.participantName).toBe('Unsaved edit'); expect(f.draft.moreInfoRequests).toEqual([note]);
    expect(f.state.mergeMessageReadResult(record({ revision: 3, participantName: 'External edit' }), 'admin')).toBe(false);
    expect(f.current.value?.participantName).toBe('Synthetic');
    f.scope.stop();
});
it('rejects another request, identity, or older revision and replaces clean drafts on a full refresh', () => {
    const f = setup();
    expect(f.state.mergeMessageReadResult(record({ id: 2 }), 'admin')).toBe(false);
    expect(f.state.mergeMessageReadResult(record(), 'agency')).toBe(false);
    expect(f.state.mergeMessageReadResult(record({ revision: 0 }), 'admin')).toBe(false);
    expect(f.state.mergeMessageReadResult(record({ revision: 2, participantName: 'Updated' }), 'admin')).toBe(true);
    expect(f.draft.participantName).toBe('Updated'); f.scope.stop();
});
it('batches visible reads, retries revision conflicts, and clears queued reads on request switching', async () => {
    const f = setup();
    f.markRead.mockRejectedValueOnce({ statusCode: 409 });
    f.state.queueMessageRead('one'); f.state.queueMessageRead('one'); f.state.queueMessageRead('two');
    await vi.advanceTimersByTimeAsync(80);
    expect(f.markRead).toHaveBeenCalledTimes(2);
    expect(f.markRead.mock.calls[0]?.slice(0, 3)).toEqual([1, 'admin', ['one', 'two']]);
    expect(f.load).toHaveBeenCalledOnce(); expect(f.changed).toHaveBeenCalledOnce();
    f.state.queueMessageRead('old'); f.current.value = record({ id: 2 }); await nextTick();
    await vi.advanceTimersByTimeAsync(80);
    expect(f.markRead).toHaveBeenCalledTimes(2); expect(f.reset).toHaveBeenCalledOnce(); f.scope.stop();
});
it('does not apply an in-flight response to another request and removes polling/focus listeners on disposal', async () => {
    const f = setup(); let finish!: (record: RequestRecord) => void;
    f.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    f.state.start(); f.focus.dispatchEvent(new Event('focus')); f.current.value = record({ id: 2 });
    finish(record({ revision: 9, participantName: 'Old request result' })); await nextTick(); await nextTick();
    expect(f.current.value.participantName).toBe('Synthetic');
    f.scope.stop(); f.focus.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(30000);
    expect(f.load).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it('sends at most twenty distinct visible messages per batch and reports a failed read', async () => {
    const f = setup();
    for (let index = 0; index < 21; index++) f.state.queueMessageRead(`note-${index}`);
    await vi.advanceTimersByTimeAsync(160);
    expect(f.markRead).toHaveBeenCalledTimes(2);
    expect(f.markRead.mock.calls[0]?.[2]).toHaveLength(20);
    expect(f.markRead.mock.calls[1]?.[2]).toEqual(['note-20']);
    f.markRead.mockRejectedValueOnce(new Error('Offline'));
    f.state.queueMessageRead('failed'); await vi.advanceTimersByTimeAsync(80);
    expect(f.error).toHaveBeenCalledWith('Read status could not be saved. Reopen the request to try again.');
    f.scope.stop();
});
it('skips refreshes for protected drafts or hidden pages and cannot reschedule an in-flight read after disposal', async () => {
    const f = setup();
    f.protectedDraft.value = true; await f.state.refreshConversation();
    f.protectedDraft.value = false; document.hidden = true; await f.state.refreshConversation();
    expect(f.load).not.toHaveBeenCalled();
    let finish!: (value: RequestRecord) => void;
    f.markRead.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    f.state.queueMessageRead('one'); await vi.advanceTimersByTimeAsync(80);
    f.state.queueMessageRead('two'); f.scope.stop(); finish(record({ revision: 2 }));
    await vi.advanceTimersByTimeAsync(160);
    expect(f.markRead).toHaveBeenCalledOnce(); expect(f.changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
