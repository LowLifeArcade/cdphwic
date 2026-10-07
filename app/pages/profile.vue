<script setup lang="ts">
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'agency');
const form = reactive({
    preferredAnalyst: 'James Kim',
    agencies: ['Mendocino County', 'Lake County'],
    reps: ['Maria Lopez', 'David Chen'],
});
const saved = ref(false);
async function save() {
    await $fetch('/api/profile', { method: 'PUT', body: form, headers: { 'x-demo-user': identity.value } });
    saved.value = true;
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Account</p>
            <h1>Profile & assignments</h1>
            <p>Keep preferred analysts and handled agencies current.</p>
        </div>
    </div>
    <form
        class="panel form-panel"
        @submit.prevent="save"
    >
        <div class="form-grid">
            <div class="form-field full">
                <label>Preferred FPU analyst</label
                ><select
                    v-model="form.preferredAnalyst"
                    class="form-input"
                >
                    <option>James Kim</option>
                    <option>Unassigned</option></select
                ><small class="muted-copy">For local agency members.</small>
            </div>
            <div class="form-field full">
                <label>Local agencies handled</label
                ><input
                    v-model="form.agencies"
                    class="form-input"
                    placeholder="Agency names, separated by commas"
                /><small class="muted-copy"
                    >For internal FPU staff. This is a generic field until the assignment picker is finalized.</small
                >
            </div>
            <div class="form-field full">
                <label>Reps explicitly handled</label
                ><input
                    v-model="form.reps"
                    class="form-input"
                    placeholder="Rep names, separated by commas"
                />
            </div>
        </div>
        <div class="form-actions">
            <button
                class="button button-primary"
                type="submit"
            >
                Save assignments
            </button>
        </div>
        <p
            v-if="saved"
            class="muted-copy"
        >
            Assignments updated in development mode.
        </p>
    </form>
</template>
