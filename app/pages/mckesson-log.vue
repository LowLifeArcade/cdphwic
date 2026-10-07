<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Accounting</p>
            <h1>McKesson Log</h1>
            <p>Admin-only placeholder for the accounting operational log.</p>
        </div>
    </div>
    <article class="panel">
        <div class="notice">
            The accounting-specific column format is intentionally generic until the current log is provided.
        </div>
        <div
            class="request-table-wrap"
            style="margin-top: 18px"
        >
            <div
                class="request-table-head"
                style="min-width: 0; grid-template-columns: repeat(5, 1fr)"
            >
                <span>Request</span><span>Reference</span><span>Quantity</span><span>Status</span><span>Logged</span>
            </div>
            <div class="empty-state">No McKesson records seeded yet.</div>
        </div>
    </article>
</template>
