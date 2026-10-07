<script setup lang="ts">
import type { RequestRecord } from '~/../shared/domain';
defineProps<{ request: RequestRecord | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
    <aside
        v-if="request"
        class="detail-drawer"
    >
        <div class="drawer-header">
            <div>
                <span class="eyebrow">Request #{{ request.id }}</span>
                <h2>{{ request.participantName }}</h2>
            </div>
            <button
                class="icon-button"
                aria-label="Close details"
                @click="emit('close')"
            >
                ×
            </button>
        </div>
        <div class="drawer-status">
            <StatusBadge :status="request.status" /><span>Submitted {{ request.submissionDate ?? '—' }}</span>
        </div>
        <section class="detail-section">
            <h3>Request overview</h3>
            <div class="detail-grid">
                <div>
                    <span>Formula</span><strong>{{ request.productName }}</strong>
                </div>
                <div>
                    <span>Units</span><strong>{{ request.unitsRequested ?? '—' }}</strong>
                </div>
                <div>
                    <span>ETA</span><strong>{{ request.eta ?? 'Not set' }}</strong>
                </div>
                <div>
                    <span>Medical status</span><strong>{{ request.medicalStatus ?? 'Pending' }}</strong>
                </div>
                <div>
                    <span>Approval date</span><strong>{{ request.approvalDate ?? '—' }}</strong>
                </div>
                <div>
                    <span>Tracking</span><strong>{{ request.trackingNumber ?? 'Not set' }}</strong>
                </div>
            </div>
        </section>
        <section class="detail-section">
            <h3>Participant</h3>
            <div class="detail-grid">
                <div>
                    <span>WIC family ID</span><strong>{{ request.participantFamilyId ?? '—' }}</strong>
                </div>
                <div>
                    <span>Diagnosis</span><strong>{{ request.diagnosis ?? '—' }}</strong>
                </div>
            </div>
        </section>
        <section class="detail-section">
            <h3>Comments</h3>
            <p class="muted-copy">{{ request.comments ?? 'No comments added yet.' }}</p>
            <label class="field-label"
                >Internal comments<textarea
                    :value="request.internalComments ?? ''"
                    placeholder="Add an internal note..."
                />
            </label>
        </section>
        <section class="detail-section">
            <h3>Attachments</h3>
            <div class="attachment-row">
                <span class="attachment-icon">↗</span>
                <div><strong>Prescription</strong><small>PDF or image · validation pending</small></div>
                <span>···</span>
            </div>
            <div class="attachment-row">
                <span class="attachment-icon">▤</span>
                <div><strong>Authorization form</strong><small>Internal attachment placeholder</small></div>
                <span>···</span>
            </div>
        </section>
    </aside>
</template>
