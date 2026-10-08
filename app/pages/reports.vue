<script setup lang="ts">
import type { MasterLogRow, McKessonLogRecord } from '~/../shared/domain';

const { data: masterLog } = await useFetch<{ months: string[]; rows: MasterLogRow[] }>('/api/reports/master-log');
const { data: mckessonLog } = await useFetch<{ rows: McKessonLogRecord[] }>('/api/reports/mckesson-log');
const masterRows = computed(() => masterLog.value?.rows ?? []);
const masterMonths = computed(() => masterLog.value?.months ?? []);
const mckessonRows = computed(() => mckessonLog.value?.rows ?? []);
const masterColumns = [
    ['dateSentToState', 'Date Sent to State'],
    ['processedBy', 'Processed By'],
    ['localAgency', 'Local Agency'],
    ['contact', 'Contact'],
    ['phoneNumber', 'Phone Number'],
    ['requestKind', 'New or Extension'],
    ['participant', 'Participant'],
    ['familyId', 'Family ID'],
    ['dob', 'DOB'],
    ['participantAgeOnDateSent', 'Participant Age on Date Sent'],
    ['formulaRequested', 'Formula Requested'],
    ['diagnosis', 'Diagnosis'],
    ['mediCalStatus', 'Medi-Cal Status'],
    ['company', 'Company'],
    ['dateGivenToReview', 'Date given to Review'],
    ['dateOrdered', 'Date Ordered'],
    ['status', 'STATUS'],
] as const;
const mckessonColumns = [
    ['orderDate', 'Order Date'],
    ['line', 'Line'],
    ['formula', 'Formula'],
    ['poPrice', 'PO Price'],
    ['cases', 'Cs'],
    ['amount', 'Amount'],
    ['creditNotes', 'Credit Notes'],
    ['orderNumber', 'Order #'],
    ['invoiceDate', 'Invoice Date'],
    ['invoiceNumber', 'Invoice #'],
    ['participant', 'Participant'],
    ['localAgency', 'Local Agency'],
    ['address', 'Address'],
    ['analyst', 'Analyst'],
] as const;

function monthKey(label: string) {
    const [month, , year] = label.split('/');
    return `${year}-${month.padStart(2, '0')}`;
}

function monthMaximum(label: string) {
    return Math.max(1, ...masterRows.value.map((row) => row.monthlyUnits[monthKey(label)] ?? 0));
}

function currency(value: number) {
    return `$${value.toFixed(2)}`;
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Admin</p>
            <h1>Reports</h1>
            <p>Review the Master Log and McKesson purchasing activity.</p>
        </div>
    </div>

    <section class="panel report-section">
        <div class="panel-heading">
            <div>
                <h2>Master Log</h2>
                <span>Requests submitted to the state and their processing status</span>
            </div>
            <div class="form-actions">
                <a
                    class="button button-secondary"
                    href="/api/reports/master-log.csv"
                    download
                    >↓ CSV</a
                >
                <a
                    class="button button-primary"
                    href="/api/reports/master-log.xlsx"
                    download
                    >↓ Excel</a
                >
            </div>
        </div>
        <div class="report-table-wrap">
            <table class="report-table master-log-table">
                <thead>
                    <tr>
                        <th
                            v-for="column in masterColumns"
                            :key="column[0]"
                        >
                            {{ column[1] }}
                        </th>
                        <th
                            v-for="month in masterMonths"
                            :key="month"
                        >
                            {{ month }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in masterRows"
                        :key="`${row.familyId}-${row.dateSentToState}-${row.formulaRequested}`"
                    >
                        <td
                            v-for="column in masterColumns"
                            :key="column[0]"
                        >
                            {{ row[column[0]] }}
                        </td>
                        <td
                            v-for="month in masterMonths"
                            :key="month"
                            class="bar-cell"
                        >
                            <span
                                class="table-data-bar"
                                :style="{
                                    width: `${((row.monthlyUnits[monthKey(month)] ?? 0) / monthMaximum(month)) * 100}%`,
                                }"
                            />
                            <strong>{{ row.monthlyUnits[monthKey(month)] ?? 0 }}</strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p
            v-if="!masterRows.length"
            class="muted-copy"
        >
            No requests are available for the Master Log.
        </p>
    </section>

    <section class="panel report-section">
        <div class="panel-heading">
            <div>
                <h2>McKesson Log</h2>
                <span>Order, invoice, participant, and analyst details</span>
            </div>
            <div class="form-actions">
                <a
                    class="button button-secondary"
                    href="/api/reports/mckesson-log.csv"
                    download
                    >↓ CSV</a
                >
                <a
                    class="button button-primary"
                    href="/api/reports/mckesson-log.xlsx"
                    download
                    >↓ Excel</a
                >
            </div>
        </div>
        <div class="report-table-wrap">
            <table class="report-table mckesson-log-table">
                <thead>
                    <tr>
                        <th
                            v-for="column in mckessonColumns"
                            :key="column[0]"
                        >
                            {{ column[1] }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in mckessonRows"
                        :key="`${row.orderNumber}-${row.line}`"
                    >
                        <td
                            v-for="column in mckessonColumns"
                            :key="column[0]"
                        >
                            {{ ['poPrice', 'amount'].includes(column[0]) ? currency(row[column[0]]) : row[column[0]] }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p
            v-if="!mckessonRows.length"
            class="muted-copy"
        >
            No McKesson orders are available.
        </p>
    </section>
</template>
