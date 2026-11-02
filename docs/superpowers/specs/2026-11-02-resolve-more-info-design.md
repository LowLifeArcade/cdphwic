# Resolve More Info Requested

User confirmed: CDPH/WIC and Admin may click Resolved to clear More Info Requested and return the request to In Progress, preserving notes and replies.

Use a section-level action to resolve outstanding notes together, saving resolvedAt/resolvedBy for history. Existing deleted notes remain deleted. Show the resolved date to all viewers; resolved notes no longer accept agency replies or grant correction access. Reviewers can send a new information request later. A stale revision or repeated resolution must fail without changing data. Existing shipment/approval details remain intact.

Approaches: a note-only marker would leave the request pending and was not selected. The user selected resolving the workflow and returning to In Progress. Use the existing request PUT command and atomic revision-checked persistence; no database migration required.

Review ruling: allow resolution only during needs_info/unopened/opened/in_progress review stages, preventing historical notes from reopening shipped/completed/denied/approved requests.
