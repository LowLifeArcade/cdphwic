<script setup lang="ts">
const downloading = ref(false);
async function downloadReport() {
    downloading.value = true;
    const blob = await $fetch('/api/reports/requests', { responseType: 'blob' });
    const url = URL.createObjectURL(blob as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cdphwic-requests.xlsx';
    link.click();
    URL.revokeObjectURL(url);
    downloading.value = false;
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Admin</p>
            <h1>Reports</h1>
            <p>Download operational data in a format that can be shared with accounting.</p>
        </div>
        <button
            class="button button-primary"
            :disabled="downloading"
            @click="downloadReport"
        >
            ↓ {{ downloading ? 'Preparing…' : 'Download XLSX' }}
        </button>
    </div>
    <div class="dashboard-grid">
        <article class="panel">
            <div class="panel-heading">
                <div>
                    <h2>Request log</h2>
                    <span>Current seeded request view</span>
                </div>
                <span class="status-badge status-approved">Ready</span>
            </div>
            <p class="muted-copy">
                The first report uses the request-log columns and is ready to connect to the current accounting format.
            </p>
        </article>
        <article class="panel">
            <div class="panel-heading">
                <div>
                    <h2>Report filters</h2>
                    <span>Coming next</span>
                </div>
            </div>
            <div class="filter-bar">
                <select class="filter-select">
                    <option>Year to date</option>
                    <option>Last 30 days</option></select
                ><select class="filter-select">
                    <option>All agencies</option>
                    <option>Mendocino County</option>
                </select>
            </div>
        </article>
    </div>
</template>
