# Resolve More Info Implementation

Approved scope: reviewer-only section action; return to In Progress; preserve history.

1. Add regression tests for reviewer resolution, Local Agency denial, stale revision, historical replies, cleared notices and correction access, and repeated resolution.
2. Add resolution metadata, server command, and workflow guards.
3. Add Resolved action and dated history in request detail.
4. Run tests and production build. Do not push unless asked.

Completed: 313 tests across 68 files passed; production build passed. Isolated preview #9906 confirmed Resolved removes More Info Requested, returns In Progress, preserves reply and shows resolved date. Fresh review caught historical notes reopening finalized requests; shared UI/server eligibility now restricts resolution to review stages, covered by regression test. No push/deployment.
