import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { SurplusDisposalRow } from '../shared/surplusDisposalReport';
import { useSurplusDisposalReport } from '../app/features/surplus/composables/useSurplusDisposalReport';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

function row(formula_name: string): SurplusDisposalRow {
    return {
        id: formula_name, kind: 'Donation', event_date: '2026-10-01', quantity: 1, original_quantity: 1,
        corrected: false, formula_name, form: 'powder', flavor: '', packaging: '', expiration_date: '2026-12-31',
        clinic_name: '', agency_id: formula_name === 'Agency Formula' ? 10 : 11,
        agency_name: 'Agency', staff_name: 'Staff', recorded_by: 'User', recorded_at: '2026-10-01 10:00:00',
    };
}

describe('surplus disposal report client state', () => {
    it('does not apply a pending reviewer search after switching to an agency identity', async () => {
        const identity = ref<'admin' | 'agency' | 'internal'>('admin');
        const pending: Array<{ identity: string; result: ReturnType<typeof deferred<SurplusDisposalRow[]>> }> = [];
        const scope = effectScope();
        let report!: ReturnType<typeof useSurplusDisposalReport>;
        scope.run(() => {
            report = useSurplusDisposalReport({
                identity,
                fetchRows: async (requestIdentity) => {
                    const result = deferred<SurplusDisposalRow[]>();
                    pending.push({ identity: requestIdentity, result });
                    return result.promise;
                },
                fetchCsv: async () => new Blob(),
                download: vi.fn(),
            });
        });

        const reviewerRequest = report.search();
        identity.value = 'agency';
        await nextTick();
        expect(pending.map((request) => request.identity)).toEqual(['admin', 'agency']);
        pending[1]!.result.resolve([row('Agency Formula')]);
        await Promise.resolve();
        pending[0]!.result.resolve([row('Other Agency Formula')]);
        await reviewerRequest;
        await Promise.resolve();

        expect(report.rows.value.map((item) => item.formula_name)).toEqual(['Agency Formula']);
        expect(report.loaded.value).toBe(true);
        scope.stop();
    });

    it('does not download a reviewer CSV after switching to an agency identity', async () => {
        const identity = ref<'admin' | 'agency' | 'internal'>('admin');
        const csv = deferred<Blob>();
        const downloads = vi.fn();
        const pendingSearch: Array<ReturnType<typeof deferred<SurplusDisposalRow[]>>> = [];
        const scope = effectScope();
        let report!: ReturnType<typeof useSurplusDisposalReport>;
        scope.run(() => {
            report = useSurplusDisposalReport({
                identity,
                fetchRows: async () => {
                    const request = deferred<SurplusDisposalRow[]>();
                    pendingSearch.push(request);
                    return request.promise;
                },
                fetchCsv: async () => csv.promise,
                download: downloads,
            });
        });
        report.loaded.value = true;
        const exportRequest = report.downloadCsv();
        identity.value = 'agency';
        await nextTick();
        csv.resolve(new Blob(['reviewer data']));
        await exportRequest;
        expect(downloads).not.toHaveBeenCalled();
        pendingSearch[0]?.resolve([row('Agency Formula')]);
        await Promise.resolve();
        scope.stop();
    });
});
