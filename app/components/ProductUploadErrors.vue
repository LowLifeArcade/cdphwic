<script setup lang="ts">
import type { ProductUploadIssue } from '../../shared/productUploadErrors';
defineProps<{ message: string; issues: ProductUploadIssue[] }>();
</script>

<template>
    <section v-if="message" class="upload-errors" role="alert" aria-label="Product upload errors" tabindex="-1">
        <h3>Upload needs corrections</h3>
        <p class="upload-error-message">{{ message }}</p>
        <div v-if="issues.length" class="upload-errors-scroll">
            <table>
                <caption>Spreadsheet cells to correct</caption>
                <thead><tr><th scope="col">Row / cell</th><th scope="col">Formula Name</th><th scope="col">Column</th><th scope="col">Entered value</th><th scope="col">How to fix</th></tr></thead>
                <tbody>
                    <tr v-for="(issue, index) in issues" :key="index">
                        <td>{{ issue.row ?? 'Header' }}<span v-if="issue.cell"> · {{ issue.cell }}</span></td>
                        <td>{{ issue.formulaName || '—' }}</td>
                        <td>{{ issue.column }}</td>
                        <td><code>{{ issue.value || '(blank)' }}</code></td>
                        <td>{{ issue.message }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-else>No products were added. Correct the file and upload again.</p>
    </section>
</template>

<style scoped>
.upload-errors { margin-block: 1rem; padding: 1rem; border: 1px solid currentColor; border-radius: 0.5rem; }
.upload-errors h3 { margin-top: 0; }
.upload-error-message { white-space: pre-wrap; overflow-wrap: anywhere; }
.upload-errors-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; margin-bottom: 0.5rem; font-weight: 600; }
th, td { padding: 0.6rem; text-align: left; vertical-align: top; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); }
td code { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
