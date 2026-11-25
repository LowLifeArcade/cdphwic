# Surplus Disposal Report Design

## Intent

Give local agencies a searchable history of donated and destroyed surplus formula for a selected date range. Admin and CDPH/WIC internal users can access the report across agencies.

## Goals

- Search by the donation or destruction date entered by staff, inclusive of both selected dates.
- Show donation and destruction movements with event date, activity, quantity, formula and package details, clinic, agency, attesting staff, recording user, and system-recorded timestamp.
- Limit agency users to their own agency. Admin and CDPH/WIC users may view all agencies.
- Provide an on-screen table and CSV download for the same filtered results.
- Keep the existing Admin Reports page and its data access unchanged.

## Non-goals

- Uploading or retaining completed donation/destruction forms.
- Editing or correcting inventory records from the report.
- Changing inventory movement persistence or transaction rules.

## Approaches

1. **Dedicated surplus disposal report page (recommended; working choice).** Add a report page and endpoint with explicit role-scoped reads, linked from Formula Surplus navigation. This serves all intended roles without broadening access to the existing Admin Reports page.
2. **Embed a report section in Formula Surplus.** This is close to the inventory workflow but makes the existing inventory page more crowded and couples report browsing to inventory interactions.

## Design

- Add a dedicated report route and a navigation link available to local agency, Admin, and CDPH/WIC users.
- Add a read-only API endpoint that validates optional inclusive `from` and `to` ISO dates and rejects invalid or reversed ranges. It returns only donation and destruction deduction movements whose persisted staff-entered event date matches the selected range.
- Derive agency scope from the authenticated/demo user context on the server: an agency user always sees only its own agency; reviewer roles may see all agencies. Do not trust a client-provided agency identifier to expand access.
- Show filters, results, empty state, and CSV download using the same result set. Include the event date and system-recorded timestamp so late entry is clear.
- Preserve correction history: report the effective corrected quantity for corrected disposal entries, and retain the original event as identified in inventory history.

## Constraints and implementation calls

- Follow the existing surplus persistence and role helpers; do not change D1 schema or inventory transaction boundaries.
- Event date is the staff-entered `date` persisted in the movement reason JSON. The system `created_at` timestamp is displayed separately and is not used for date filtering.
- The report is read-only and does not retain completed form documents.
- Date bounds may be used independently; omitting both shows all available donation/destruction records within the caller's permitted scope.
