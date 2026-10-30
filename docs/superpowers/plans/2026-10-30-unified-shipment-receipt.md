# Unified Shipment Receipt

User approved one receipt flow with quantity entry, conditional issue notes and damage requirements, a single Confirm Receipt action, compact saved summary and Edit Receipt for corrections. Remove standalone Report Issue and nested receipt forms. Keep follow-up evidence, CDPH/WIC responses and existing issue history attached to the original receipt.

- Add guarded issue notes to receipt confirmation. Quantity corrections update the same issue and resolve quantity discrepancies when corrected; preserve evidence and responses.
- Receipt component shows entry only before confirmation or while Edit Receipt is active. Show damage fields conditionally; accept damage images in the same confirmation flow using existing evidence APIs. Distinguish a saved receipt from a failed evidence upload and allow retry.
- Issue component displays existing issues only; retain response/evidence follow-up, remove standalone reporting and duplicate receipt entry.
- Verify quantity/note corrections, issue history preservation, stale issue guards, UI entry/summary/edit states, full suite and build.

Completed. Verification: 258 tests pass; production build succeeds. Isolated Local Agency browser check confirmed partial receipt plus notes in one save; Edit Receipt corrected quantities and resolved the same issue; no standalone Report Issue or duplicate quantity form. Damage image confirmation succeeded. A simulated rejected image left the receipt saved; retry after a concurrent reviewer response refreshed the issue, attached the image, preserved the response, and left receipt history at four entries (no duplicate quantity confirmation). Review found and verified the stale-retry fix.
