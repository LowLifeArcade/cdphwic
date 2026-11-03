# Review Decision design

Approved approach: three visible buttons after Health Care Provider for CDPH/WIC and Admin. Request More Info reveals the existing conversation, Approve saves approval and reveals State-Issued Formula Authorization, Deny requires a reason and confirmation then closes the request until a reviewer explicitly reopens it. Local Agency sees the saved decision and relevant messages/authorization. Existing message history, issuance and shipments remain preserved.

Approaches: visible buttons were selected over a compact dropdown because all three actions are immediately discoverable. Retaining controls within authorization was rejected because the decision precedes authorization.

Implementation calls: title Review Decision; approval/denial closes outstanding information exchanges while preserving history; denied requests display the reason and reviewer-only Reopen Request, which returns In Progress without approval. Denied requests reject further request mutations until reopened. Existing approved records remain visible. UI uses existing Nuxt/Vue and palette. No migration or deployment.
