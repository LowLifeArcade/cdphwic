<script setup lang="ts">
import type { SurplusDisposalRow } from '#shared/surplusDisposalReport';
import { formatDisplayDate, formulaFormLabel } from '#shared/requestPresentation';
import { unitLabel } from '#shared/quantityLabels';
import { useSurplusDisposalReport } from '~/features/surplus/composables/useSurplusDisposalReport';

const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const { fromDate, toDate, rows, loading, exporting, loaded, error, search, downloadCsv } = useSurplusDisposalReport({
    identity,
    fetchRows: (requestIdentity, query) => $fetch<SurplusDisposalRow[]>('/api/surplus/dispositions', {
        headers: { 'x-demo-user': requestIdentity }, query,
    }),
    fetchCsv: (requestIdentity, query) => $fetch<Blob>('/api/surplus/dispositions.csv', {
        headers: { 'x-demo-user': requestIdentity }, query, responseType: 'blob',
    }),
    download(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'surplus-disposals.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
});

onMounted(() => { void search(); });
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Formula Surplus</p>
            <h1>Donation &amp; Destruction Report</h1>
            <p>Search recorded donations and verified destructions by the date staff entered.</p>
        </div>
    </div>

    <section class="panel disposal-report">
        <form class="report-filters" @submit.prevent="search">
            <label>Event date from<input v-model="fromDate" type="date" /></label>
            <label>Event date to<input v-model="toDate" type="date" /></label>
            <button class="button button-primary" type="submit" :disabled="loading">
                {{ loading ? 'Searching…' : 'Search' }}
            </button>
            <button class="button button-secondary" type="button" :disabled="exporting || !loaded" @click="downloadCsv">
                {{ exporting ? 'Preparing CSV…' : 'Download CSV' }}
            </button>
        </form>
        <p class="report-date-note">The date range includes both dates. Recorded At shows when the entry was saved.</p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="loading && !loaded" role="status">Loading disposal history…</p>
        <p v-else-if="loaded && !rows.length && !error" class="muted-copy">No donations or destructions match this date range.</p>
        <div v-else-if="rows.length" class="report-table-wrap">
            <table class="report-table disposal-table">
                <thead>
                    <tr>
                        <th>Event Date</th>
                        <th>Activity</th>
                        <th>Quantity</th>
                        <th>Formula</th>
                        <th>Agency</th>
                        <th>Clinic</th>
                        <th>Staff Attesting</th>
                        <th>Recorded By</th>
                        <th>Recorded At</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.id">
                        <td>{{ row.event_date ? formatDisplayDate(row.event_date) : 'Date not recorded' }}</td>
                        <td>{{ row.kind }}</td>
                        <td>
                            {{ row.quantity }} {{ unitLabel(row.quantity) }}
                            <small v-if="row.corrected" class="correction-label">Corrected from {{ row.original_quantity }}</small>
                        </td>
                        <td>{{ [row.formula_name, formulaFormLabel(row.form), row.flavor, row.packaging].filter(Boolean).join(' · ') }}</td>
                        <td>{{ row.agency_name }}</td>
                        <td>{{ row.clinic_name || 'Not specified' }}</td>
                        <td>{{ row.staff_name || '—' }}</td>
                        <td>{{ row.recorded_by }}</td>
                        <td>{{ row.recorded_at }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>

<style scoped>
.disposal-report {padding:20px;}
.report-filters {display:flex;align-items:end;gap:12px;flex-wrap:wrap;}
.report-filters label {display:grid;gap:5px;font-size:13px;font-weight:600;}
.report-filters input {min-height:40px;border:1px solid var(--line);border-radius:6px;padding:7px 10px;background:var(--surface);color:var(--text);font:inherit;}
.report-date-note {margin:12px 0 18px;color:var(--muted);font-size:13px;}
.report-table-wrap {overflow:auto;}
.disposal-table {width:100%;border-collapse:collapse;}
.disposal-table th,.disposal-table td {padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);}
.disposal-table th {white-space:nowrap;}
.correction-label {display:block;color:var(--muted);white-space:nowrap;}
@media(max-width:650px) {.report-filters {align-items:stretch;flex-direction:column;}.report-filters .button {width:100%;}}
</style>
