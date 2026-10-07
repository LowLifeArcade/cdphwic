<script setup lang="ts">
const router = useRouter();
const submitted = ref(false);
const form = reactive({
    participantName: '',
    familyId: '',
    dob: '',
    medicalStatus: 'pending',
    benefitsCycleDate: '',
    productName: '',
    diagnosis: '',
    requestKind: 'new',
    unitsRequested: '',
    additionalNotes: '',
});
async function submitRequest() {
    submitted.value = true;
    await $fetch('/api/requests', {
        method: 'POST',
        body: {
            agencyId: 10,
            agencyMemberId: 100,
            participantName: form.participantName || 'New participant',
            participantFamilyId: Number(form.familyId) || undefined,
            productName: form.productName || 'Formula to be selected',
            status: 'pending',
            medicalStatus: form.medicalStatus,
            diagnosis: form.diagnosis,
            unitsRequested: Number(form.unitsRequested) || undefined,
            genericFields: { benefitsCycleDate: form.benefitsCycleDate, additionalNotes: form.additionalNotes },
        },
    });
    await router.push('/requests');
}
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Requests</p>
            <h1>New request</h1>
            <p>Create a request and attach the supporting documentation.</p>
        </div>
        <NuxtLink
            class="button button-ghost"
            to="/requests"
            >Cancel</NuxtLink
        >
    </div>
    <form
        class="panel form-panel"
        @submit.prevent="submitRequest"
    >
        <div class="form-grid">
            <div class="form-field">
                <label for="participant">Participant name</label
                ><input
                    id="participant"
                    v-model="form.participantName"
                    class="form-input"
                    placeholder="First and last name"
                    required
                />
            </div>
            <div class="form-field">
                <label for="family">WIC family ID</label
                ><input
                    id="family"
                    v-model="form.familyId"
                    class="form-input"
                    placeholder="Family ID"
                />
            </div>
            <div class="form-field">
                <label for="dob">Birthdate</label
                ><input
                    id="dob"
                    v-model="form.dob"
                    class="form-input"
                    type="date"
                />
            </div>
            <div class="form-field">
                <label for="medical">Medical status</label
                ><select
                    id="medical"
                    v-model="form.medicalStatus"
                    class="form-input"
                >
                    <option value="pending">Pending</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            </div>
            <div class="form-field">
                <label for="cycle">Benefits cycle date</label
                ><input
                    id="cycle"
                    v-model="form.benefitsCycleDate"
                    class="form-input"
                    type="date"
                />
            </div>
            <div class="form-field">
                <label for="kind">Request type</label
                ><select
                    id="kind"
                    v-model="form.requestKind"
                    class="form-input"
                >
                    <option value="new">New request</option>
                    <option value="extension">Extension</option>
                </select>
            </div>
            <div class="form-field">
                <label for="formula">Formula / product</label
                ><input
                    id="formula"
                    v-model="form.productName"
                    class="form-input"
                    list="formula-options"
                    placeholder="Start typing a formula"
                /><datalist id="formula-options">
                    <option>Nutramigen</option>
                    <option>EleCare</option>
                    <option>Enfamil Infant</option>
                    <option>Neocate Splash</option>
                </datalist>
            </div>
            <div class="form-field">
                <label for="units">Units requested</label
                ><input
                    id="units"
                    v-model="form.unitsRequested"
                    class="form-input"
                    type="number"
                    min="1"
                    placeholder="Number of units"
                />
            </div>
            <div class="form-field full">
                <label for="diagnosis">Diagnosis</label
                ><input
                    id="diagnosis"
                    v-model="form.diagnosis"
                    class="form-input"
                    placeholder="Diagnosis or medical reason"
                />
            </div>
            <div class="form-field full">
                <label>Prescription</label>
                <div class="upload-drop">
                    <strong>Drop a PDF or image here</strong
                    ><span
                        >AI validation will be connected later. For now this is a validation-pending placeholder.</span
                    >
                </div>
            </div>
            <div class="form-field full">
                <label for="notes">Additional information</label
                ><textarea
                    id="notes"
                    v-model="form.additionalNotes"
                    class="form-textarea"
                    placeholder="Use this generic field for information not yet modeled."
                />
            </div>
        </div>
        <div class="form-actions">
            <NuxtLink
                class="button button-ghost"
                to="/requests"
                >Cancel</NuxtLink
            ><button
                class="button button-primary"
                type="submit"
            >
                Submit request
            </button>
        </div>
        <p
            v-if="submitted"
            class="muted-copy"
        >
            Request saved. Returning to the request list…
        </p>
    </form>
</template>
