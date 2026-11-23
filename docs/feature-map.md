# Feature map

Read the row for the requested change, then follow only the imports you need. Paths below are relative to the repository root. Client features use Nuxt’s `#shared/` alias (also configured in Vitest). Feature modules are imported explicitly; existing pages and public components remain entry points.

## Requests

| Change | Start here | Related contract / data | Focused tests (`npx vitest run …`) |
| --- | --- | --- | --- |
| New request fields/defaults | `app/features/requests/requestForm.ts`; `components/RequestParticipantFields.vue`, `RequestProviderFields.vue`, `RequestFoodRestrictionFields.vue` in that feature folder | `shared/newRequestFields.ts`, `shared/requestSubmission.ts` | `test/requestCreationSections.test.ts test/requestSubmission.test.ts` |
| Submitted payload/conditional fields | `app/features/requests/requestSubmissionBody.ts` | `shared/requestSubmission.ts`; `server/api/requests/index.post.ts`, `[id]/submission.put.ts` | `test/requestSubmissionPayload.test.ts test/submissionEditing.test.ts` |
| Incomplete draft save/restore | `app/features/requests/requestDraft.ts` | `server/utils/requestDraftStore.ts`; draft route loading stays in the page | `test/requestDraftPayload.test.ts test/requestDraftStore.test.ts` |
| Diagnosis entry/editing | `app/features/requests/composables/useRequestDiagnoses.ts` | `shared/diagnosisCatalog.ts`; diagnosis markup in `app/pages/requests/new.vue` | `test/requestDiagnosisState.test.ts test/requestFormDoctorFields.test.ts` |
| Prescription upload/removal | `app/features/requests/composables/usePrescriptionUpload.ts` | Extraction mapping / network callbacks in `app/pages/requests/new.vue`; `server/utils/prescriptionParser.ts`, `prescriptionStorage.ts` | `test/requestPrescriptionState.test.ts test/prescriptionParser.test.ts` |
| Request medical detail display | `app/features/requests/components/RequestMedicalDetails.vue` | `shared/requestPresentation.ts`; save validation in `app/components/RequestDetailDrawer.vue` | `test/requestMedicalDetails.test.ts test/requestOperationsUi.test.ts` |
| Catalog selection / issuance quantities | `app/features/requests/components/RequestAuthorizationFields.vue`, `composables/useAuthorizationEditor.ts` | `shared/productMatching.ts`, `formulaAuthorizations.ts`, `catalogOrderDefaults.ts` | `test/requestAuthorizationFields.test.ts test/catalogOrderSelectionUi.test.ts test/productCandidates.test.ts` |
| Background messages / read receipts | `app/features/requests/composables/useRequestConversationSync.ts` | `shared/moreInfoMessages.ts`; drawer supplies protected-draft predicate and network adapters | `test/requestConversationSync.test.ts test/requestFollowup.test.ts` |
| Server request reads / concurrency | `server/features/requests/persistence.ts` | D1 `surplus_submissions.request_json`; `surplus_guard` transaction guard | `test/requestPersistence.test.ts test/requestSubmissionDate.test.ts` |
| Edit/resubmit stored request | `server/features/requests/submission.ts` | `shared/requestEditing.ts`; shipping and surplus-report helpers | `test/submissionEditing.test.ts test/requestSurplusRestoration.test.ts` |
| Review decision / more-info commands | `server/features/requests/review.ts`, `conversation.ts`, `messageReads.ts` | `shared/requestEditing.ts`, `moreInfoMessages.ts`; notice reads | `test/requestFollowup.test.ts test/requestPersistence.test.ts` |
| Shipment persistence / publish / receipt | `server/features/requests/shipments.ts` (plans), `shipmentReceipts.ts`, `shipmentActions.ts` | `shared/shipmentPublishing.ts`, `shipmentReceipts.ts`, `shipmentCaseTracking.ts`; existing `Shipment*Panel.vue` components | `test/shipmentPublishing.test.ts test/shipmentReceipts.test.ts test/receiptCatalogPackaging.test.ts` |
| Agency transfers / local surplus | `server/utils/requestTransfers.ts`, `requestTransferInventory.ts`, `requestLocalSurplus.ts` | `shared/requestTransfers.ts`; `app/components/RequestTransferAllocation.vue`, `RequestSupplyPlan.vue` | `test/requestAgencyTransfers.test.ts test/requestTransferPackaging.test.ts test/requestSurplusRestoration.test.ts` |
| List/filter/history | `app/components/RequestList.vue`, `shared/requestScope.ts`, `requestListFilters.ts` | `server/api/requests/index.get.ts`, `history.post.ts` | `test/requestScope.test.ts test/requestListSections.test.ts test/requestHistoryRoute.test.ts` |

`app/pages/requests/new.vue` owns route loading, draft/edit restoration, form coordination and submit/save navigation. `app/components/RequestDetailDrawer.vue` owns the shared editing draft, save coordination, transfer allocation and shipment orchestration. Read those sections only when the requested change crosses workflow boundaries.

`server/utils/submittedRequests.ts` is a compatibility export facade: follow its named export directly to the owning workflow. Do not add implementation there.

## Products

| Change | Start here | Related contract / data | Focused tests |
| --- | --- | --- | --- |
| Edit fields / options / normalization | `shared/productEditor.ts`; `app/features/products/components/ProductEditorFields.vue` | `app/pages/products/[id].vue`; create page deliberately retains its existing distinct fields | `test/productEditor.test.ts test/productEditorUi.test.ts` |
| Create/update/delete action feedback | `app/features/products/composables/useProductMutation.ts`; relevant page in `app/pages/products/` | `server/api/products/` | `test/productFeature.test.ts test/productDeleteRoute.test.ts` |
| Catalog list / matching | `app/pages/products/index.vue`; `shared/productMatching.ts` | `app/components/ProductVariantSelect.vue` | `test/productCatalogTable.test.ts test/productMatching.test.ts test/productCandidates.test.ts` |
| Persistence / validation | `server/utils/productRepository.ts`, `productDatabase.ts`, `productValidation.ts` | D1 `products` table; metadata migration `0019_product_catalog_persistence.sql` | `test/productRepository.test.ts test/productMigration.test.ts test/productDeleteRoute.test.ts` |
| Bulk upload/update | `server/utils/productImport.ts`; `app/pages/products/bulk-upload.vue` | `shared/productUploadErrors.ts`, API `bulk.post.ts`, `bulk-update.post.ts` | `test/productImport.test.ts test/productBulkUpdateImport.test.ts test/productBulkUpdateRoute.test.ts` |

## Data ownership and invariants

- Persisted requests live as JSON in D1 `surplus_submissions`. Reads are agency-scoped; writes compare the full previous JSON in a guarded batch, advance revision, and preserve request identity. Inventory and notice statements that belong to a write stay in the same batch.
- `server/utils/requestStore.ts` is the legacy seeded in-memory fallback used by request routes, not the D1 source of truth. Inspect the route before changing either path.
- Product production reads/writes use `productRepository.ts` and `productDatabase.ts`. `test/helpers/productStore.ts` is a legacy fixture only. Inactive products remain resolvable for historical snapshots.
- Put browser-free rules in `shared/`. Client feature modules must not import `server/`; persistence primitives must not import workflow modules.
- Stateful composables own per-instance refs. Request/identity switching, unsaved edits, and asynchronous cleanup require regression coverage.

Use `npm test` and `npm run build` for final integration checks. Source-layout tests cover selected markup contracts; behavioral tests exercise state/data changes directly. Historical specs/plans are background only, not required reading for ordinary features.
