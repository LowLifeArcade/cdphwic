# More Info Conversation Implementation Plan

1. Regression test repeated reviewer/agency messages, resubmission, role attribution, reciprocal notifications, resolved and unrelated-agency rejection.
2. Extend response metadata and shared eligibility; accept authorized reviewer replies through existing command.
3. Render dated author labels and reply controls for both views. Send additional reviewer notes into latest active thread.
4. Run full tests/build, isolated UI check and fresh review. No push/deploy.

Completed: 314 tests across 68 files passed and production build passed. Isolated request #9906 verified initial message, agency reply, reviewer follow-up, and second agency reply in the same thread with composer retained. Fresh review found no material issues. Screenshot /tmp/cdphwic-ongoing-more-info.jpg. Changes remain unpushed.

Follow-up requirement: read messages cannot be deleted. Opening request details or marking a message notification read records recipient read receipts. Replies imply reading prior incoming messages. Delete hides in the UI and is rejected server-side, including stale revisions and legacy notification reads after an edit. No schema migration.

Read-lock verification: 318 tests across 68 files passed; production build passed. Isolated UI confirmed recipient opening records Read dates and CDPH/WIC has zero Delete note buttons afterward. Fresh review found no material issues. Screenshot /tmp/cdphwic-read-message-lock.jpg. No push/deploy.

Latest refinement: read messages cannot be edited either. Pending form corrections keep Update and Resubmit in the section heading, independent of replying. Replace purple bars with neutral cards, sender labels and subtle agency/reviewer styling. Bell unread badge and New markers show incoming messages; opening the conversation marks incoming notifications read. View Message refreshes even an already-open request.

Refinement verification: 319 tests passed across 68 files and production build passed. Isolated two-role UI confirmed neutral cards and sender labels, persistent top-level Update and Resubmit, incoming New notification, View Message opening updated content and unread count dropping from 4 to 3. Fresh review caught same selected request/manual-open notification refresh edge; watcher now fetches on query changes and event refresh handles unchanged query. Screenshots /tmp/cdphwic-neutral-conversation.jpg and /tmp/cdphwic-new-message-notification.jpg. No push/deploy.

Explicit reopening plan: regression-test message-only no edit access, reviewer-only reopen, grant consumption and repeat cycles; add server command and shared eligibility; approved accordion applies to LA; blue conversation header with Reopen/Resolved actions, LA correction action only after explicit grant; run tests/build, fresh review and isolated UI.

Explicit reopen verification: 320 tests passed across 68 files; production build passed. Fresh review found no material issues. Isolated approved request #9906 in LA view starts collapsed with no correction link; CDPH/WIC shows Reopen for Resubmission and Resolved. Clicking Reopen grants LA correction access while approved accordion remains collapsed. Screenshots /tmp/cdphwic-approved-agency-collapsed.jpg and /tmp/cdphwic-more-info-reviewer-controls.jpg. No push/deploy.
