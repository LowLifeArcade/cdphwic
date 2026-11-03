# Review Decision design

Approved approach: three visible buttons after Health Care Provider for CDPH/WIC and Admin. Request More Info reveals the existing conversation, Approve saves approval and reveals State-Issued Formula Authorization, Deny requires a reason and confirmation then closes the request until a reviewer changes it through Edit. Local Agency sees the saved decision and relevant messages/authorization. Existing message history, issuance and shipments remain preserved.

Approaches: visible buttons were selected over a compact dropdown because all three actions are immediately discoverable. Retaining controls within authorization was rejected because the decision precedes authorization.

Implementation calls: title Review Decision; approval/denial closes outstanding information exchanges while preserving history; denied requests display the reason and reviewer-only Edit control that reveals the three decision choices again. Denied requests reject further request mutations until reopened. Existing approved records remain visible. UI uses existing Nuxt/Vue and palette. No migration or deployment.

Refinement: saved Approve/Deny decisions replace the buttons with a summary and Edit. Edit reveals the choices without mutating the decision; Cancel leaves the saved decision intact. A denied decision can be changed directly through the dedicated reviewer command, retaining revision and permission checks. An unsent Request More Info composer has Cancel, removing draft content and leaving saved history and status intact. The Review Decision header uses #141F68 with white text to distinguish it from participant/provider details.
