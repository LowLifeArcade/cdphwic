<script setup lang="ts">
const { data } = await useFetch('/api/participants');
</script>
<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">People</p>
            <h1>Participants</h1>
            <p>Participant records connected to agency requests.</p>
        </div>
    </div>
    <div class="panel">
        <div
            class="request-table-head"
            style="min-width: 0; grid-template-columns: 1.5fr 1fr 1fr 1fr"
        >
            <span>Participant</span><span>Family ID</span><span>Benefits cycle</span><span>Medical status</span>
        </div>
        <div
            v-for="participant in data?.participants ?? []"
            :key="participant.familyId"
            class="request-row"
            style="min-width: 0; grid-template-columns: 1.5fr 1fr 1fr 1fr"
        >
            <span
                ><strong>{{ participant.name }}</strong
                ><small>DOB {{ participant.dob }}</small></span
            ><span
                ><strong>{{ participant.familyId }}</strong></span
            ><span
                ><strong>{{ participant.benefitsCycleDate }}</strong></span
            ><span><StatusBadge :status="participant.medicalStatus" /></span>
        </div>
    </div>
</template>
