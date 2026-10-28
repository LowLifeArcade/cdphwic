<script setup lang="ts">
import type { ClinicAddress } from '~/../shared/shipping';
const props = defineProps<{ modelValue: ClinicAddress; prefix: string; required?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: ClinicAddress] }>();
const fields = [
    { key: 'clinicName', label: 'Clinic Name' },
    { key: 'addressLine1', label: 'Street Address' },
    { key: 'addressLine2', label: 'Address Line 2 (optional)' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'postalCode', label: 'ZIP Code' },
] as const;
function update(key: keyof ClinicAddress, value: string) {
    emit('update:modelValue', { ...props.modelValue, [key]: key === 'state' ? value.toUpperCase() : value });
}
</script>
<template>
    <div class="form-grid">
        <div
            v-for="field in fields"
            :key="field.key"
            class="form-field"
        >
            <label :for="`${prefix}-${field.key}`">{{ field.label }}</label
            ><input
                :id="`${prefix}-${field.key}`"
                :value="modelValue[field.key]"
                class="form-input"
                :required="required && field.key !== 'addressLine2'"
                :maxlength="field.key === 'state' ? 2 : field.key === 'postalCode' ? 10 : 250"
                :pattern="
                    field.key === 'postalCode'
                        ? '[0-9]{5}(-[0-9]{4})?'
                        : field.key === 'state'
                          ? '[A-Za-z]{2}'
                          : undefined
                "
                @input="update(field.key, ($event.target as HTMLInputElement).value)"
            />
        </div>
    </div>
</template>
