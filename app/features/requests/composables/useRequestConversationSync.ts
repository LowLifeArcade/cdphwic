import { nextTick, onScopeDispose, watch, type Ref } from 'vue';
import type { RequestRecord } from '#shared/domain';
import { sameRequestOutsideMessages } from '#shared/moreInfoMessages';
interface ConversationSyncOptions {
    request: () => RequestRecord | null;
    identity: Ref<string>;
    draft: Partial<RequestRecord>;
    copyRequest: (request: RequestRecord) => Partial<RequestRecord>;
    hasProtectedDraft: () => boolean;
    load: (id: number, identity: string) => Promise<RequestRecord>;
    markRead: (id: number, identity: string, noticeIds: string[], revision: number) => Promise<RequestRecord>;
    changed: () => void;
    error: (message: string) => void;
    reset: () => void;
}

/** Synchronize messages independently of the editor; never replace a protected draft. */
export function useRequestConversationSync(options: ConversationSyncOptions) {
    const visibleReadQueue = new Set<string>();
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    let conversationTimer: ReturnType<typeof setInterval> | undefined;
    let readingMessages = false;
    let disposed = false;
    function sameContext(id: number, identity: string) {
        return !disposed && options.request()?.id === id && options.identity.value === identity;
    }
    function mergeMessageReadResult(request: RequestRecord, identityAtRead: string) {
        const current = options.request();
        if (!current || !sameContext(request.id, identityAtRead) || (request.revision ?? 0) < (current.revision ?? 0)) {
            return false;
        }
        const otherFieldsChanged = !sameRequestOutsideMessages(current, request);
        if (otherFieldsChanged && options.hasProtectedDraft()) {
            return false;
        }
        if (otherFieldsChanged) {
            for (const key of Object.keys(current)) {
                if (!(key in request)) {
                    delete current[key as keyof RequestRecord];
                }
            }
            Object.assign(current, request);
            for (const key of Object.keys(options.draft)) {
                delete options.draft[key as keyof RequestRecord];
            }
            Object.assign(options.draft, options.copyRequest(request));
        } else {
            const messages = {
                moreInfoRequests: request.moreInfoRequests,
                revision: request.revision,
            };
            Object.assign(current, messages);
            Object.assign(options.draft, messages);
        }
        return true;
    }
    function queueMessageRead(id: string) {
        if (disposed) {
            return;
        }
        visibleReadQueue.add(id);
        if (!readingMessages && !readTimer) {
            readTimer = setTimeout(flushMessageReads, 80);
        }
    }
    async function flushMessageReads() {
        readTimer = undefined;
        const current = options.request();
        if (disposed || !current || readingMessages || !visibleReadQueue.size) {
            return;
        }
        const who = options.identity.value;
        const ids = Array.from(visibleReadQueue).slice(0, 20);
        ids.forEach((id) => visibleReadQueue.delete(id));
        readingMessages = true;
        try {
            for (let attempt = 0; attempt < 3; attempt++) {
                if (!sameContext(current.id, who)) {
                    return;
                }
                try {
                    const result = await options.markRead(current.id, who, ids, options.request()!.revision ?? 0);
                    if (!disposed) {
                        mergeMessageReadResult(result, who);
                        options.changed();
                    }
                    break;
                } catch (error) {
                    if (
                        (
                            error as {
                                statusCode?: number;
                            }
                        ).statusCode !== 409 ||
                        attempt === 2
                    ) {
                        throw error;
                    }
                    const fresh = await options.load(current.id, who);
                    if (!mergeMessageReadResult(fresh, who)) {
                        throw new Error('Request fields changed.');
                    }
                    await nextTick();
                }
            }
        } catch {
            if (sameContext(current.id, who)) {
                options.error('Read status could not be saved. Reopen the request to try again.');
            }
        } finally {
            readingMessages = false;
            if (!disposed && visibleReadQueue.size && !readTimer) {
                readTimer = setTimeout(flushMessageReads, 80);
            }
        }
    }
    async function refreshConversation() {
        const current = options.request();
        if (disposed || !current || document.hidden || readingMessages || options.hasProtectedDraft()) {
            return;
        }
        const who = options.identity.value;
        try {
            mergeMessageReadResult(await options.load(current.id, who), who);
        } catch {
            // Keep existing content when a background refresh fails.
        }
    }
    function resetQueue() {
        visibleReadQueue.clear();
        if (readTimer) {
            clearTimeout(readTimer);
        }
        readTimer = undefined;
    }
    watch([() => options.request()?.id, options.identity], () => {
        resetQueue();
        options.reset();
    });
    function start() {
        if (!disposed && !conversationTimer) {
            conversationTimer = setInterval(refreshConversation, 15000);
            window.addEventListener('focus', refreshConversation);
        }
    }
    onScopeDispose(() => {
        disposed = true;
        resetQueue();
        if (conversationTimer) {
            clearInterval(conversationTimer);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('focus', refreshConversation);
        }
    });
    return {
        queueMessageRead,
        mergeMessageReadResult,
        refreshConversation,
        start,
    };
}
