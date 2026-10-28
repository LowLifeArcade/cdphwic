<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
const props = defineProps<{ requestId: number; attachment: NonNullable<RequestRecord['prescriptionAttachment']> }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const documentBlob = ref<Blob>();
const documentUrl = ref('');
const loading = ref(false);
const error = ref('');
let generation = 0;
function revoke() {
    if (documentUrl.value) URL.revokeObjectURL(documentUrl.value);
    documentUrl.value = '';
    documentBlob.value = undefined;
}
async function load() {
    const current = ++generation;
    loading.value = true;
    error.value = '';
    revoke();
    try {
        const blob = await $fetch<Blob>(`/api/requests/${props.requestId}/prescription`, {
            headers: { 'x-demo-user': identity.value },
            responseType: 'blob',
        });
        if (current !== generation) return;
        documentBlob.value = blob;
        documentUrl.value = URL.createObjectURL(blob);
    } catch {
        if (current === generation) error.value = 'The uploaded document could not be opened.';
    } finally {
        if (current === generation) loading.value = false;
    }
}
onMounted(load);
onBeforeUnmount(() => {
    generation++;
    revoke();
});
</script>
<template>
    <div class="request-document-preview">
        <p
            v-if="loading"
            role="status"
        >
            Loading document…
        </p>
        <div
            v-else-if="error"
            class="submission-alert"
            role="alert"
        >
            {{ error }}
            <button
                type="button"
                class="text-button"
                @click="load"
            >
                Retry
            </button>
        </div>
        <template v-else-if="documentUrl">
            <a
                :href="documentUrl"
                :download="attachment.fileName"
                class="text-button document-download"
                >Download {{ attachment.fileName }}</a
            >
            <RequestPdfPreview
                v-if="attachment.contentType === 'application/pdf' && documentBlob"
                :document="documentBlob"
            />
            <div
                v-else-if="attachment.contentType.startsWith('image/')"
                class="document-image-scroll"
            >
                <img
                    :src="documentUrl"
                    :alt="attachment.fileName"
                />
            </div>
            <p v-else>Download the document to open this file type.</p>
        </template>
    </div>
</template>
<style scoped>
.request-document-preview {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
}
.request-document-preview > p {
    padding: 16px;
}
.document-download {
    padding: 10px 16px;
    overflow-wrap: anywhere;
}
iframe {
    width: 100%;
    flex: 1;
    min-height: 0;
    border: 0;
    background: white;
}
.document-image-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
}
img {
    display: block;
    width: 100%;
    height: auto;
}
</style>
