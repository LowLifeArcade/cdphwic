<script setup lang="ts">
defineProps<{ name: string; productNumber: string; busy: boolean; error?: string }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => dialog.value?.showModal());
</script>

<template>
    <dialog ref="dialog" class="product-delete-dialog" aria-labelledby="delete-product-title" aria-describedby="delete-product-description" @cancel.prevent="!busy && emit('cancel')">
        <h2 id="delete-product-title">Delete this product?</h2>
        <p id="delete-product-description">Remove <strong>{{ name }}</strong> (Product Number: <strong>{{ productNumber }}</strong>) from the product catalog? Existing request history will be retained.</p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="form-actions">
            <button class="button button-ghost" type="button" autofocus :disabled="busy" @click="emit('cancel')">Cancel</button>
            <button class="button button-danger" type="button" :disabled="busy" @click="emit('confirm')">{{ busy ? 'Deleting…' : 'Delete product' }}</button>
        </div>
    </dialog>
</template>

<style scoped>
.product-delete-dialog { max-width: min(460px, calc(100vw - 32px)); padding: 24px; border: 1px solid var(--line); border-radius: 12px; color: var(--text); background: var(--surface); }
.product-delete-dialog::backdrop { background: rgb(0 0 0 / 55%); }
h2 { margin-top: 0; }
p { line-height: 1.6; overflow-wrap: anywhere; }
</style>
