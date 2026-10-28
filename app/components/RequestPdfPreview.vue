<script setup lang="ts">
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist/types/src/display/api';
const props = defineProps<{ document: Blob }>();
const canvas = ref<HTMLCanvasElement>();
const container = ref<HTMLElement>();
const pageNumber = ref(1);
const pageCount = ref(0);
const loading = ref(true);
const error = ref('');
const pageText = ref('');
let pdf: PDFDocumentProxy | undefined;
let loadingTask: PDFDocumentLoadingTask | undefined;
let renderTask: RenderTask | undefined;
let observer: ResizeObserver | undefined;
let disposed = false;
let renderVersion = 0;
let lastWidth = 0;
async function renderPage() {
    if (!pdf || !canvas.value || !container.value || disposed) return;
    const version = ++renderVersion;
    if (renderTask) {
        renderTask.cancel();
        try {
            await renderTask.promise;
        } catch {}
        renderTask = undefined;
    }
    if (version !== renderVersion || disposed) return;
    loading.value = true;
    error.value = '';
    try {
        const page = await pdf.getPage(pageNumber.value);
        if (disposed || version !== renderVersion) return;
        const context = canvas.value?.getContext('2d');
        if (!context) return;
        const initial = page.getViewport({ scale: 1 });
        lastWidth = container.value!.clientWidth;
        const width = Math.max(100, lastWidth - 32);
        const viewport = page.getViewport({ scale: width / initial.width });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.value!.width = Math.ceil(viewport.width * ratio);
        canvas.value!.height = Math.ceil(viewport.height * ratio);
        canvas.value!.style.width = `${viewport.width}px`;
        canvas.value!.style.height = `${viewport.height}px`;
        const task = page.render({
            canvasContext: context,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        renderTask = task;
        await task.promise;
        if (disposed || version !== renderVersion) return;
        const text = await page.getTextContent();
        if (!disposed && version === renderVersion)
            pageText.value = text.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    } catch (e) {
        if (!disposed && version === renderVersion && (e as { name?: string }).name !== 'RenderingCancelledException')
            error.value = 'This PDF page could not be displayed. Download the file to view it.';
    } finally {
        if (!disposed && version === renderVersion) loading.value = false;
    }
}
onMounted(async () => {
    try {
        const [pdfjs, worker] = await Promise.all([
            import('pdfjs-dist/build/pdf.mjs'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const bytes = await props.document.arrayBuffer();
        if (disposed) return;
        loadingTask = pdfjs.getDocument({
            data: new Uint8Array(bytes),
            isEvalSupported: false,
            useSystemFonts: true,
        });
        pdf = await loadingTask.promise;
        if (disposed) {
            await pdf.destroy();
            return;
        }
        pageCount.value = pdf.numPages;
        await nextTick();
        await renderPage();
        if (disposed) return;
        observer = new ResizeObserver(() => {
            if (container.value && container.value.clientWidth !== lastWidth) void renderPage();
        });
        if (container.value) observer.observe(container.value);
    } catch {
        if (!disposed) {
            loading.value = false;
            error.value = 'The PDF could not be displayed. Download the file to view it.';
        }
    }
});
watch(pageNumber, () => {
    void renderPage();
});
onBeforeUnmount(() => {
    disposed = true;
    renderVersion++;
    observer?.disconnect();
    renderTask?.cancel();
    void loadingTask?.destroy();
});
</script>
<template>
    <div class="pdf-preview">
        <div
            v-if="pageCount"
            class="pdf-toolbar"
        >
            <button
                type="button"
                class="button button-ghost"
                :disabled="pageNumber <= 1"
                aria-label="Previous document page"
                @click="pageNumber--"
            >
                Previous</button
            ><span>Page {{ pageNumber }} of {{ pageCount }}</span
            ><button
                type="button"
                class="button button-ghost"
                :disabled="pageNumber >= pageCount"
                aria-label="Next document page"
                @click="pageNumber++"
            >
                Next
            </button>
        </div>
        <p
            v-if="loading"
            role="status"
        >
            Rendering document…
        </p>
        <p
            v-if="error"
            class="submission-alert"
            role="alert"
        >
            {{ error }}
        </p>
        <div
            ref="container"
            class="pdf-page"
        >
            <canvas
                ref="canvas"
                role="img"
                :aria-label="`Medical documentation, page ${pageNumber} of ${pageCount}`"
            />
            <p class="pdf-page-text">{{ pageText }}</p>
        </div>
    </div>
</template>
<style scoped>
.pdf-preview {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}
.pdf-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px;
    border-bottom: 1px solid var(--line);
}
.pdf-preview > p {
    margin: 8px 16px;
}
.pdf-page {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
    background: var(--surface-raised);
}
canvas {
    display: block;
    max-width: 100%;
    background: white;
}
.pdf-page-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
</style>
