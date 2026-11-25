import { ref, watch, type Ref } from 'vue';
import type { SurplusDisposalRow } from '#shared/surplusDisposalReport';

export type DisposalReportIdentity = 'admin' | 'agency' | 'internal';
export interface DisposalReportQuery { from?: string; to?: string }

export function useSurplusDisposalReport(options: {
    identity: Ref<DisposalReportIdentity>;
    fetchRows: (identity: DisposalReportIdentity, query: DisposalReportQuery) => Promise<SurplusDisposalRow[]>;
    fetchCsv: (identity: DisposalReportIdentity, query: DisposalReportQuery) => Promise<Blob>;
    download: (blob: Blob) => void;
}) {
    const fromDate = ref('');
    const toDate = ref('');
    const rows = ref<SurplusDisposalRow[]>([]);
    const loading = ref(false);
    const exporting = ref(false);
    const loaded = ref(false);
    const error = ref('');
    let activeQuery: DisposalReportQuery = {};
    let searchRevision = 0;
    let exportRevision = 0;

    function dateQuery(): DisposalReportQuery {
        return {
            ...(fromDate.value ? { from: fromDate.value } : {}),
            ...(toDate.value ? { to: toDate.value } : {}),
        };
    }

    async function search() {
        const revision = ++searchRevision;
        const requestIdentity = options.identity.value;
        const query = dateQuery();
        rows.value = [];
        loading.value = true;
        loaded.value = false;
        error.value = '';
        try {
            const result = await options.fetchRows(requestIdentity, query);
            if (revision !== searchRevision || requestIdentity !== options.identity.value) return;
            rows.value = result;
            activeQuery = query;
            loaded.value = true;
        } catch (cause) {
            if (revision !== searchRevision || requestIdentity !== options.identity.value) return;
            error.value = (cause as { statusMessage?: string }).statusMessage ?? 'Could not load donation and destruction history.';
        } finally {
            if (revision === searchRevision && requestIdentity === options.identity.value) loading.value = false;
        }
    }

    async function downloadCsv() {
        if (!loaded.value) return;
        const revision = ++exportRevision;
        const requestIdentity = options.identity.value;
        exporting.value = true;
        error.value = '';
        try {
            const blob = await options.fetchCsv(requestIdentity, activeQuery);
            if (revision !== exportRevision || requestIdentity !== options.identity.value) return;
            options.download(blob);
        } catch (cause) {
            if (revision !== exportRevision || requestIdentity !== options.identity.value) return;
            error.value = (cause as { statusMessage?: string }).statusMessage ?? 'Could not download the disposal report.';
        } finally {
            if (revision === exportRevision && requestIdentity === options.identity.value) exporting.value = false;
        }
    }

    watch(options.identity, () => {
        searchRevision++;
        exportRevision++;
        rows.value = [];
        activeQuery = {};
        loading.value = false;
        exporting.value = false;
        loaded.value = false;
        error.value = '';
        void search();
    });

    return { fromDate, toDate, rows, loading, exporting, loaded, error, search, downloadCsv };
}
