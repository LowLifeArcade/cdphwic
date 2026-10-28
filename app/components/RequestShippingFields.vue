<script setup lang="ts">
import { blankClinicAddress, formatClinic, type ClinicRecord, type RequestShipping } from '~/../shared/shipping';
const props = defineProps<{ modelValue: RequestShipping; agencyId: number; allowSavedSnapshot?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: RequestShipping] }>();
const identity = useState<'admin' | 'agency' | 'internal'>('demo-identity', () => 'admin');
const { data, error, refresh } = await useFetch<{ clinics: ClinicRecord[] }>(
    () => `/api/agencies/${props.agencyId}/clinics`,
    { headers: computed(() => ({ 'x-demo-user': identity.value })) },
);
const mode = ref(props.modelValue.clinicId ?? (props.modelValue.clinicName ? 'new' : ''));
watch(
    () => props.modelValue.clinicId,
    (id) => {
        if (id) mode.value = id;
    },
);
watch(
    () => props.agencyId,
    () => {
        mode.value = '';
        emit('update:modelValue', { ...blankClinicAddress(), attention: props.modelValue.attention });
    },
);
const selectedSnapshot = computed(
    () =>
        props.modelValue.clinicId && data.value && !data.value.clinics.some((c) => c.id === props.modelValue.clinicId),
);
function choose(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    mode.value = value;
    const clinic = data.value?.clinics.find((c) => c.id === value);
    emit(
        'update:modelValue',
        clinic
            ? {
                  clinicId: clinic.id,
                  clinicName: clinic.clinicName,
                  addressLine1: clinic.addressLine1,
                  addressLine2: clinic.addressLine2,
                  city: clinic.city,
                  state: clinic.state,
                  postalCode: clinic.postalCode,
                  attention: props.modelValue.attention,
              }
            : { ...blankClinicAddress(), attention: props.modelValue.attention },
    );
}
</script>
<template>
    <div class="form-field">
        <label for="shipping-clinic">Clinic Shipping Address</label
        ><select
            id="shipping-clinic"
            class="form-input"
            :value="mode"
            :data-inactive-clinic="selectedSnapshot && !allowSavedSnapshot ? 'true' : undefined"
            required
            @change="choose"
        >
            <option
                disabled
                value=""
            >
                Select a clinic address
            </option>
            <option
                v-for="clinic in data?.clinics ?? []"
                :key="clinic.id"
                :value="clinic.id"
            >
                {{ formatClinic(clinic) }}
            </option>
            <option
                v-if="selectedSnapshot && modelValue.clinicId"
                :value="modelValue.clinicId"
            >
                {{ formatClinic(modelValue) }}
                {{ allowSavedSnapshot ? '(saved with request)' : '(archived — choose an active address)' }}
            </option>
            <option value="new">Enter a new address</option>
        </select>
    </div>
    <p
        v-if="selectedSnapshot && !allowSavedSnapshot"
        class="submission-alert"
    >
        This saved clinic address is archived. Choose an active clinic or enter a new address before submitting.
    </p>
    <p
        v-if="error"
        class="submission-alert"
        role="alert"
    >
        Clinic addresses could not be loaded.
        <button
            type="button"
            class="text-button"
            @click="refresh()"
        >
            Retry
        </button>
    </p>
    <p
        v-else-if="!data?.clinics.length"
        class="muted-copy"
    >
        No clinic addresses have been added for this local agency. Enter a new address here or manage the agency’s
        address book.
    </p>
    <div
        v-if="mode === 'new'"
        class="shipping-new-address"
    >
        <ClinicAddressFields
            :model-value="modelValue"
            prefix="shipping"
            required
            @update:model-value="emit('update:modelValue', { ...$event, attention: modelValue.attention })"
        />
        <p class="muted-copy">
            This address will be saved with this request. Add it to the agency address book separately to use it on
            future requests.
        </p>
    </div>
    <address
        v-else-if="mode"
        class="shipping-preview"
    >
        <strong>{{ modelValue.clinicName }}</strong
        ><br />{{ modelValue.addressLine1 }}<br v-if="modelValue.addressLine2" /><template
            v-if="modelValue.addressLine2"
            >{{ modelValue.addressLine2 }}</template
        ><br />{{ modelValue.city }}, {{ modelValue.state }} {{ modelValue.postalCode }}
    </address>
    <div class="form-field shipping-attention">
        <label for="shipping-attention">Attention</label
        ><input
            id="shipping-attention"
            :value="modelValue.attention"
            class="form-input"
            required
            maxlength="150"
            placeholder="Local agency representative’s name"
            @input="emit('update:modelValue', { ...modelValue, attention: ($event.target as HTMLInputElement).value })"
        />
    </div>
</template>
