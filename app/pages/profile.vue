<script setup lang="ts">
interface AgencyOption {
    id: number;
    name: string;
    shippingAddress: string;
    city: string;
    state: string;
    postalCode: string;
}
interface ProfileResponse {
    user?: { name?: string; email?: string; phone?: string; additionalInfo?: string };
    agency?: AgencyOption & { preferredInternalMemberId?: number };
    rep?: { name: string; email: string; phone?: string };
    analysts?: Array<{ id: number; name: string }>;
    agencies?: AgencyOption[];
    handledAgencyIds?: number[];
}

const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'agency');
const profile = ref<ProfileResponse>({});
const agencies = ref<AgencyOption[]>([]);
const saved = ref(false);
const agencyForm = reactive({ name: '', county: '', shippingAddress: '', city: '', state: 'CA', postalCode: '' });
const accountForm = reactive({ name: '', email: '', phone: '', additionalInfo: '' });
const repForm = reactive({
    name: '',
    email: '',
    phone: '',
    preferredInternalMemberId: undefined as number | undefined,
});
const selectedAgencyIds = ref<number[]>([]);
const agencySearch = ref('');
const highlightedAgencyIndex = ref(0);

const isAgencyRep = computed(() => identity.value === 'agency');
const isStaff = computed(() => identity.value === 'internal');
const selectedAgencies = computed(() => agencies.value.filter((agency) => selectedAgencyIds.value.includes(agency.id)));
const agencySuggestions = computed(() => {
    const search = agencySearch.value.trim().toLowerCase();
    return agencies.value
        .filter(
            (agency) =>
                !selectedAgencyIds.value.includes(agency.id) && (!search || agency.name.toLowerCase().includes(search)),
        )
        .slice(0, 6);
});

async function loadProfile() {
    const [profileResult, agencyResult] = await Promise.all([
        $fetch<ProfileResponse>('/api/profile', { headers: { 'x-demo-user': identity.value } }),
        $fetch<{ agencies: AgencyOption[] }>('/api/agencies'),
    ]);
    profile.value = profileResult;
    agencies.value = agencyResult.agencies;
    accountForm.name = profileResult.user?.name ?? '';
    accountForm.email = profileResult.user?.email ?? '';
    accountForm.phone = profileResult.user?.phone ?? '';
    accountForm.additionalInfo = profileResult.user?.additionalInfo ?? '';
    if (profileResult.agency) {
        agencyForm.name = profileResult.agency.name;
        agencyForm.county = profileResult.agency.city;
        agencyForm.shippingAddress = profileResult.agency.shippingAddress;
        agencyForm.city = profileResult.agency.city;
        agencyForm.state = profileResult.agency.state;
        agencyForm.postalCode = profileResult.agency.postalCode;
    }
    if (profileResult.rep) {
        Object.assign(repForm, profileResult.rep);
    }

    repForm.preferredInternalMemberId = profileResult.agency?.preferredInternalMemberId;
    selectedAgencyIds.value = profileResult.handledAgencyIds ?? [];
}

function addAgency(agency?: AgencyOption) {
    const next = agency ?? agencySuggestions.value[highlightedAgencyIndex.value];
    if (!next || selectedAgencyIds.value.includes(next.id)) {
        return;
    }

    selectedAgencyIds.value.push(next.id);
    agencySearch.value = '';
    highlightedAgencyIndex.value = 0;
}

function removeAgency(id: number) {
    selectedAgencyIds.value = selectedAgencyIds.value.filter((agencyId) => agencyId !== id);
}

function handleAgencyKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlightedAgencyIndex.value = Math.min(
            highlightedAgencyIndex.value + 1,
            Math.max(agencySuggestions.value.length - 1, 0),
        );
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlightedAgencyIndex.value = Math.max(highlightedAgencyIndex.value - 1, 0);
    } else if ((event.key === 'Enter' || event.key === 'Tab') && agencySuggestions.value.length) {
        event.preventDefault();
        addAgency();
    }
}

async function save() {
    const body = isAgencyRep.value
        ? {
              user: accountForm,
              preferredInternalMemberId: repForm.preferredInternalMemberId,
              agency: {
                  name: agencyForm.name,
                  shippingAddress: agencyForm.shippingAddress,
                  city: agencyForm.county || agencyForm.city,
                  state: agencyForm.state,
                  postalCode: agencyForm.postalCode,
              },
              rep: { name: accountForm.name, email: accountForm.email, phone: accountForm.phone },
          }
        : { user: accountForm, handledAgencyIds: selectedAgencyIds.value };
    await $fetch('/api/profile', { method: 'PUT', body, headers: { 'x-demo-user': identity.value } });
    saved.value = true;
}

watch(identity, loadProfile, { immediate: true });
</script>

<template>
    <div class="page-heading">
        <div>
            <p class="eyebrow">Account</p>
            <h1>Profile & assignments</h1>
            <p>Keep your organization and assignment details current.</p>
        </div>
    </div>
    <form
        class="panel form-panel"
        @submit.prevent="save"
    >
        <div class="profile-section">
            <p class="eyebrow">{{ isAgencyRep ? 'LA Rep' : 'Account' }}</p>
            <h2>{{ isAgencyRep ? 'Your representative profile' : 'Your information' }}</h2>
            <div class="form-grid">
                <div class="form-field full">
                    <label>Name</label
                    ><input
                        v-model="accountForm.name"
                        class="form-input"
                        required
                    />
                </div>
                <div class="form-field">
                    <label>Email</label
                    ><input
                        v-model="accountForm.email"
                        class="form-input"
                        type="email"
                        required
                    />
                </div>
                <div class="form-field">
                    <label>Phone</label
                    ><input
                        v-model="accountForm.phone"
                        class="form-input"
                    />
                </div>
                <div class="form-field full">
                    <label>Additional information</label
                    ><textarea
                        v-model="accountForm.additionalInfo"
                        class="form-input"
                        rows="3"
                        placeholder="Optional profile details"
                    />
                </div>
            </div>
        </div>
        <template v-if="isAgencyRep">
            <div class="profile-section">
                <p class="eyebrow">Local Agency</p>
                <h2>Your agency</h2>
                <p class="muted-copy">These changes update the Local Agency record connected to your account.</p>
                <div class="form-grid">
                    <div class="form-field full">
                        <label>Agency name</label
                        ><input
                            v-model="agencyForm.name"
                            class="form-input"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label>County</label
                        ><input
                            v-model="agencyForm.county"
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label>City</label
                        ><input
                            v-model="agencyForm.city"
                            class="form-input"
                        />
                    </div>
                    <div class="form-field full">
                        <label>Shipping address</label
                        ><input
                            v-model="agencyForm.shippingAddress"
                            class="form-input"
                            required
                        />
                    </div>
                    <div class="form-field">
                        <label>State</label
                        ><input
                            v-model="agencyForm.state"
                            class="form-input"
                        />
                    </div>
                    <div class="form-field">
                        <label>Postal code</label
                        ><input
                            v-model="agencyForm.postalCode"
                            class="form-input"
                        />
                    </div>
                    <div class="form-field full">
                        <label>Preferred FPU analyst</label
                        ><select
                            v-model="repForm.preferredInternalMemberId"
                            class="form-input"
                        >
                            <option :value="undefined">Unassigned</option>
                            <option
                                v-for="analyst in profile.analysts ?? []"
                                :key="analyst.id"
                                :value="analyst.id"
                            >
                                {{ analyst.name }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if="isStaff">
            <div class="profile-section">
                <p class="eyebrow">Staff assignments</p>
                <h2>Local agencies handled</h2>
                <p class="muted-copy">Search for an agency, then press Tab or click a result to add it.</p>
                <div class="autocomplete-field">
                    <input
                        v-model="agencySearch"
                        class="form-input"
                        placeholder="Search local agencies..."
                        @keydown="handleAgencyKeydown"
                    />
                    <div
                        v-if="agencySearch && agencySuggestions.length"
                        class="autocomplete-menu"
                    >
                        <button
                            v-for="(agency, index) in agencySuggestions"
                            :key="agency.id"
                            type="button"
                            class="autocomplete-option"
                            :class="{ highlighted: index === highlightedAgencyIndex }"
                            @click="addAgency(agency)"
                        >
                            {{ agency.name }}
                        </button>
                    </div>
                </div>
                <div
                    v-if="selectedAgencies.length"
                    class="chip-list"
                >
                    <span
                        v-for="agency in selectedAgencies"
                        :key="agency.id"
                        class="profile-chip"
                        >{{ agency.name
                        }}<button
                            type="button"
                            :aria-label="`Remove ${agency.name}`"
                            @click="removeAgency(agency.id)"
                        >
                            ×
                        </button></span
                    >
                </div>
                <p
                    v-else
                    class="muted-copy"
                >
                    No agencies assigned yet.
                </p>
            </div>
        </template>
        <div
            v-else
            class="profile-section"
        >
            <p class="eyebrow">Administrator</p>
            <h2>Admin profile</h2>
            <p class="muted-copy">Admin accounts do not use agency assignment settings.</p>
        </div>
        <div class="form-actions">
            <button
                class="button button-primary"
                type="submit"
            >
                Save profile
            </button>
        </div>
        <p
            v-if="saved"
            class="muted-copy"
        >
            Profile updated in development mode.
        </p>
    </form>
</template>
