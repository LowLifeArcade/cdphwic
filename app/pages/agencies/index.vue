<script setup lang="ts">
const identity=useState<'admin'|'agency'|'internal'>('demo-identity',()=> 'admin');
const { data } = await useFetch('/api/agencies');
const {data:profile}=await useFetch('/api/profile',{headers:computed(()=>({'x-demo-user':identity.value}))});
const visibleAgencies=computed(()=> (data.value?.agencies??[]).filter(a=>identity.value==='admin'||identity.value==='agency'&&a.id===profile.value?.user?.agencyId||identity.value==='internal'&&(profile.value?.handledAgencyIds??[]).includes(a.id)));
</script>
<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Local agencies</p>
            <h1>Agencies</h1>
            <p>Manage local agency relationships, reps, and preferred analysts.</p>
        </div>
        <button class="button button-primary">＋ Add agency</button>
    </div>
    <div class="detail-page-grid">
        <article
            v-for="agency in visibleAgencies"
            :key="agency.id"
            class="data-card"
        >
            <h3>{{ agency.name }}</h3>
            <div class="data-list">
                <div>
                    <span>Shipping</span><strong>{{ agency.shippingAddress }}</strong>
                </div>
                <div>
                    <span>Location</span><strong>{{ agency.city }}, {{ agency.state }}</strong>
                </div>
                <div>
                    <span>Preferred analyst</span
                    ><strong>{{ agency.preferredInternalMemberId ? 'James Kim' : 'Not assigned' }}</strong>
                </div>
                <div>
                    <span>Reps</span
                    ><strong>{{ data?.members?.filter((member) => member.agencyId === agency.id).length ?? 0 }}</strong>
                </div>
            </div>
            <ClinicAddressBook :key="`${identity}-${agency.id}`" :agency-id="agency.id" />
        </article>
    </div>
</template>
