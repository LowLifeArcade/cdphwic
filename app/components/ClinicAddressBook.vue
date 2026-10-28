<script setup lang="ts">
import { blankClinicAddress, formatClinic, type ClinicRecord, type ClinicAddress } from '~/../shared/shipping';
const props = defineProps<{ agencyId: number }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const canManage = computed(() => identity.value === 'admin' || identity.value === 'agency');
const { data, error, refresh } = await useFetch<{ clinics: ClinicRecord[] }>(
    () => `/api/agencies/${props.agencyId}/clinics`,
    { headers: computed(() => ({ 'x-demo-user': identity.value })) },
);
const editorOpen = ref(false);
const editingId = ref('');
const address = ref<ClinicAddress>(blankClinicAddress());
const busy = ref(false);
const message = ref('');
const failure = ref('');
const upload = ref<HTMLInputElement>();
function edit(clinic?: ClinicRecord) {
    editingId.value = clinic?.id ?? '';
    address.value = clinic ? { ...clinic } : blankClinicAddress();
    editorOpen.value = true;
    failure.value = '';
    message.value = '';
}
async function save() {
    busy.value = true;
    failure.value = '';
    try {
        await $fetch(`/api/agencies/${props.agencyId}/clinics${editingId.value ? '/' + editingId.value : ''}`, {
            method: editingId.value ? 'PUT' : 'POST',
            headers: { 'x-demo-user': identity.value },
            body: address.value,
        });
        await refresh();
        editorOpen.value = false;
        message.value = 'Clinic address saved.';
    } catch (e) {
        failure.value =
            (e as { data?: { statusMessage?: string } }).data?.statusMessage ??
            'The clinic address could not be saved.';
    } finally {
        busy.value = false;
    }
}
async function archive(id: string) {
    busy.value = true;
    failure.value = '';
    try {
        await $fetch(`/api/agencies/${props.agencyId}/clinics/${id}`, {
            method: 'DELETE',
            headers: { 'x-demo-user': identity.value },
        });
        await refresh();
        message.value = 'Address archived. Existing requests keep their shipping details.';
    } catch {
        failure.value = 'The clinic address could not be archived.';
    } finally {
        busy.value = false;
    }
}
async function importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy.value = true;
    failure.value = '';
    message.value = '';
    try {
        const body = new FormData();
        body.append('file', file);
        const result = await $fetch<{ count: number }>(`/api/agencies/${props.agencyId}/clinics`, {
            method: 'POST',
            headers: { 'x-demo-user': identity.value },
            body,
        });
        await refresh();
        message.value = `${result.count} clinic addresses imported.`;
    } catch (e) {
        failure.value =
            (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'The file could not be imported.';
    } finally {
        busy.value = false;
        input.value = '';
    }
}
</script>
<template>
    <section class="clinic-address-book">
        <div class="panel-heading"><h2>Clinic Address Book</h2></div>
        <p
            v-if="error"
            class="submission-alert"
            role="alert"
        >
            Clinic addresses could not be loaded.
            <button
                class="text-button"
                @click="refresh()"
            >
                Retry
            </button>
        </p>
        <ul
            v-else-if="data?.clinics.length"
            class="clinic-address-list"
        >
            <li
                v-for="clinic in data.clinics"
                :key="clinic.id"
            >
                <span>{{ formatClinic(clinic) }}</span>
                <div
                    v-if="canManage"
                    class="clinic-row-actions"
                >
                    <button
                        type="button"
                        class="text-button"
                        :disabled="busy"
                        @click="edit(clinic)"
                    >
                        Edit</button
                    ><button
                        type="button"
                        class="text-button"
                        :disabled="busy"
                        @click="archive(clinic.id)"
                    >
                        Archive
                    </button>
                </div>
            </li>
        </ul>
        <p v-else>No clinic addresses have been added.</p>
        <div
            v-if="canManage"
            class="form-actions"
        >
            <button
                type="button"
                class="button button-secondary"
                :disabled="busy"
                @click="edit()"
            >
                Add clinic address</button
            ><button
                type="button"
                class="button button-ghost"
                :disabled="busy"
                @click="upload?.click()"
            >
                Upload addresses</button
            ><input
                ref="upload"
                type="file"
                accept=".csv,.xls,.xlsx"
                hidden
                aria-label="Upload clinic addresses"
                @change="importFile"
            /><a
                class="text-button"
                href="/clinic-address-template.csv"
                download
                >Download CSV template</a
            >
        </div>
        <p
            v-if="canManage"
            class="muted-copy"
        >
            CSV or Excel, up to 500 addresses. Use the template column names. All rows are checked before any are added.
        </p>
        <form
            v-if="editorOpen"
            class="clinic-editor"
            @submit.prevent="save"
        >
            <ClinicAddressFields
                v-model="address"
                :prefix="`clinic-${agencyId}`"
                required
            />
            <div class="form-actions">
                <button
                    type="submit"
                    class="button button-primary"
                    :disabled="busy"
                >
                    {{ busy ? 'Saving…' : 'Save address' }}</button
                ><button
                    type="button"
                    class="button button-ghost"
                    :disabled="busy"
                    @click="editorOpen = false"
                >
                    Cancel
                </button>
            </div>
        </form>
        <p
            v-if="message"
            role="status"
        >
            {{ message }}
        </p>
        <p
            v-if="failure"
            class="submission-alert"
            role="alert"
        >
            {{ failure }}
        </p>
    </section>
</template>
