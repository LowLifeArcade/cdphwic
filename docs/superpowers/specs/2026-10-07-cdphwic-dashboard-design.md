# CDPHWIC Dashboard and Request Workflow Design

## Goal

Turn the existing Nuxt/Cloudflare scaffold into a simple, extensible CDPHWIC
operations dashboard inspired by the attached Nova dark analytics layout.
The first product slice should make the main workflows visible and usable
with seeded data while keeping business rules easy to extend.

## Terminology

- FPU: internal CDPHWIC staff workers who process requests.
- LA: local agency that serves participants.
- Rep: a representative of a local agency.
- Admin: a user who can manage members, assignments, reports, and accounting data.
- Member: a non-admin user limited to requests and records within their assigned scope.

## Scope

The first slice includes:

- Nova-inspired dark dashboard shell with responsive left navigation and top bar.
- Sign-in landing page with email/password authentication stub.
- Token-gated signup flow reachable only through an admin-issued invitation link.
- Access request form for people who do not yet have an invitation.
- Admin and member roles, plus internal/agency member type.
- Admin invitation workflow for agency reps and internal FPU staff.
- Admin signup-request queue with approve/deny actions.
- Agency/staff assignment model used to filter the default request view.
- Requests, products, participants, agencies, summary, reports, and McKesson Log sections.
- Request list rows with status, submission date, decision date, ETA, agency, and participant.
- Expandable request detail view with generic inputs for unresolved fields.
- New request form with participant, benefits, medical, formula, diagnosis, extension, and attachment fields.
- Seeded summary metrics and reusable date/category/product filters.
- API route stubs for creating and retrieving requests.
- D1 migrations for the initial relational model.

The first slice does not implement production password hashing/session storage,
password recovery, real email delivery, OAuth/social login, 2FA/passkeys, AI
prescription validation, real file storage, accounting workflows, or final
business-rule enforcement. Those features receive stable extension points and
placeholder UI states.

## Closed B2B access flow

The home route `/` is the sign-in page. There is no public signup link in the
main navigation and no discoverable signup page. Signup is reachable only at a
tokenized route such as `/signup/<token>` after an admin creates an invitation.

People without an invitation may use a `Request access` link on the sign-in
page. The access request form collects:

- Name
- Email
- Local agency name, or staff ID when requesting internal staff access
- A note explaining why access is needed

Access requests are visible to all admins in an admin-only `Signup Requests`
navigation section. An admin can approve or deny each request. Approval creates
an invitation token tied to the submitted email and sends or displays the
invitation link through the current development delivery stub. Denial records
the decision and prevents signup from that request.

Invitation links are unique, email-specific, single-use, and expirable. The
signup route validates the token before rendering the verification step and
rejects missing, expired, used, or email-mismatched tokens.

The first page opened by an invitation is an email verification page, not the
signup form. It shows a masked version of the invited email and asks the user
to request a one-time verification code. The code is sent to the invited email
address, expires quickly, is single-use, and has bounded attempts. Only after
the code is verified does the app create a short-lived signup session and show
the role-specific signup form. Sharing the invitation link alone is therefore
not sufficient to complete signup.

For local development, the email delivery adapter is a stub that exposes the
code in the server response/logs. Production replaces that adapter with real
email delivery without changing the token or verification contracts.

### Invitation signup branches

Agency representative invitations reference an existing Local Agency created
by an admin. The signup form shows the agency name, county, and shipping
address prefilled. The representative can edit those agency fields and their
own name, email, and phone, but cannot change the agency identity, create a
new agency, or attach themselves to another agency.

Staff invitations show name, email, phone, and handled Local Agencies. Staff
can select existing agencies or add a new agency during signup. Admins and
staff can also add agencies from their dashboard; agency representatives cannot.

The signin form accepts email and password only. Social login is intentionally
excluded. Future 2FA and passkey support should attach to the same session
boundary rather than change the invitation model.

## Roles and visibility

Users have both a role and a member type:

```text
role: admin | member
member_type: internal | agency
```

Admins can view all agencies, requests, summary metrics, reports, invitations,
and the McKesson Log. Members have two distinct request scopes:

- Local agency member: `Requests` shows every request for that member's local
  agency. `My Requests` shows requests associated with that specific rep.
- FPU/internal staff member: `Requests` shows requests across all local
  agencies, with dropdown filters for local agency and rep. `My Requests`
  shows requests from the local agencies and reps that staff member handles.

The default list applies the logged-in user's scope before rendering. Admins
may inspect all scopes and can use the same agency/rep filters.

### Editable assignments

Assignments are profile data, not a hard-coded role rule:

- A local agency member can set or change their preferred FPU analyst.
- An internal FPU member can set or change the local agencies they handle.
- The FPU member's `My Requests` scope is derived from their handled agencies
  and reps whose preferred analyst is that FPU member.
- If an analyst handles an agency but no rep-level preference exists, that
  analyst sees the agency's requests in `Requests`; `My Requests` remains
  limited to explicitly related reps.

Both profile pages expose these assignment controls. Admins can update them
for any member. Assignment changes affect list filtering immediately.

## Navigation and UI

The app shell contains:

- Brand and user identity in the left sidebar.
- Requests with a nested “My Requests” item and role-aware filtering.
- Products, Participants, Summary, and Agencies.
- Admin-only Reports and McKesson Log items.
- Admin-only Signup Requests and Invitations items.
- Global search field in the top bar.
- New Request action in the top bar.

List sections use a shared table/list pattern with status badges, compact
metadata, empty states, and expandable rows or detail drawers. Detail views
should remain in the current context where practical so a user can return to
the list without losing filters.

The visual language follows the reference image: dark navy surfaces, purple
primary actions, red warning/accent states, green success states, rounded
cards, compact metadata, and high-contrast text. The implementation should
use CSS tokens rather than hard-coded per-component colors.

## Request workflow

The request list exposes, at minimum:

- Request identifier
- Participant name/family ID
- Local agency
- Formula/product
- Status: pending, in progress, approved, denied
- Submission date
- Approval or denial date when present
- ETA when present

The request detail view includes:

- Participant: first name, last name, WIC family ID, date of birth, benefits start/cycle date, and months requested.
- Medical status: yes, no, or pending.
- Formula name and form, such as Nutramigen / powder.
- Diagnosis and generic additional information field.
- New request or extension selection.
- Surplus on hand and expiration date.
- Local agency name, shipping address, and representative contact information.
- Preferred FPU analyst and request-rep ownership metadata.
- Comments and internal comments.
- Prescription attachment and internal invoice/authorization attachment placeholders.
- Tracking number, delivery receipt status, replacement request status, and delivery condition notes.

The New Request page reuses the same request fields and adds a formula
autocomplete/select, diagnosis input, extension checkbox, and prescription
upload placeholder. The UI may display a “validation pending” state for AI
review; submission blocking is deferred until the AI integration exists.

## Admin summary and reporting

The Summary page uses seeded or API-provided aggregate data with reusable
filters:

- Date range selector, including year-to-date.
- Product selector.
- Product category selector: standard, exempt, nutritional.
- Units per product.
- Top 10 most requested formulas.
- Average units per month YTD.
- Requests per agency per month.
- Cases versus maximum available per month.
- Capacity alert when usage reaches at least 90% of the monthly maximum.

Charts may begin as CSS/SVG or lightweight chart components, but their data
must come from typed summary records so a chart library can be introduced
later without changing the API contract.

Reports includes an admin-only download action that exports a basic XLSX file
with request-log columns matching the current operational log format. The
McKesson Log is a separate admin/accounting-only table with generic columns
until the accounting format is finalized.

## Data model

The initial D1 migration creates these tables with explicit IDs and timestamps:

```text
users
  id, email, name, role, member_type, password_hash_stub, phone, staff_id, created_at

signup_tokens
  id, token, email, invitation_type, role, member_type, agency_id, access_request_id,
  expires_at, used_at, verification_code_hash, verification_expires_at,
  verification_attempts, verified_at, created_at

access_requests
  id, name, email, local_agency_name, staff_id, note, requested_member_type,
  status, reviewed_by, reviewed_at, denial_reason, created_at

agencies
  id, name, shipping_address, city, state, postal_code, active, created_at

agency_members
  id, user_id, agency_id, preferred_internal_member_id, first_name, last_name,
  email, phone, created_at

internal_members
  id, user_id, first_name, last_name, email, phone, created_at

staff_agency_assignments
  id, internal_member_id, agency_id, created_at

staff_rep_assignments
  id, internal_member_id, agency_member_id, created_at

participants
  family_id, first_name, last_name, dob, benefits_cycle_date, created_at

products
  id, name, form, category, units_per_case, active, created_at

requests
  id, participant_family_id, agency_id, agency_member_id,
  assigned_internal_member_id,
  product_id, status, submission_date, approval_date, denial_date, eta,
  benefits_months_start, benefits_months_end, medical_status, diagnosis,
  request_kind, units_requested, surplus_units, surplus_expiration_date,
  tracking_number, delivery_status, replacement_requested, comments,
  internal_comments, created_at, updated_at

request_attachments
  id, request_id, attachment_type, file_name, storage_key_stub, created_at

mckesson_logs
  id, request_id, generic_reference, quantity, status, logged_at, notes
```

Unknown fields use nullable columns or generic text fields rather than blocking
the scaffold. Business-specific constraints can be added through later
migrations.

## Server/API boundaries

Initial server routes:

```text
POST /api/auth/login
POST /api/access-requests
GET  /api/signup-tokens/:token
POST /api/signup-tokens/:token/verify/start
POST /api/signup-tokens/:token/verify/complete
POST /api/signup-tokens/:token/complete
POST /api/invitations
GET  /api/access-requests
POST /api/access-requests/:id/approve
POST /api/access-requests/:id/deny
POST /api/agencies
GET  /api/profile
PUT  /api/profile
GET  /api/requests
POST /api/requests
GET  /api/requests/:id
PUT  /api/requests/:id
GET  /api/summary
GET  /api/reports/requests
GET  /api/products
GET  /api/participants
GET  /api/agencies
```

The auth routes use a local session stub and clearly marked development
behavior. Authorization helpers should centralize role/scope checks so future
real auth can replace the session source without rewriting every route. The
token validation route must not return signup form data for an invalid token.
Verification responses must not reveal the full invited email or whether an
arbitrary email address belongs to an invitation. Signup completion requires a
verified signup session, not only the invitation token.

The first API implementation may return seeded records and perform basic
validation. It must keep request filtering parameters explicit, including
`scope` (`all` or `mine`), `agencyId`, `repId`, `assignedMemberId`, `status`,
`productId`, `category`, `from`, and `to`. Profile APIs must support reading
and updating preferred analyst and handled-agency/rep assignments.

## Validation and errors

Forms show field-level errors for required known fields and allow generic
optional fields to remain empty. API routes return consistent JSON error
objects with a human-readable message and field details where applicable.
Unauthorized admin-only access returns 403. Missing records return 404.

## Testing and acceptance

The first slice is accepted when:

1. `/` renders only the sign-in form with a `Request access` link.
2. `/signup/<token>` opens only the email verification page and rejects missing, expired, used, and mismatched tokens.
3. A valid verification code is required before the role-specific signup form is shown.
4. Verification codes expire, are single-use, and enforce bounded attempts without exposing the invited email.
5. Admin navigation includes Signup Requests, Invitations, Reports, and McKesson Log while members do not see them.
6. Access requests collect name, email, agency/staff identifier, member type, and reason note.
7. Admin approval creates an email-specific invitation link; denial records a reason and prevents signup.
8. Agency rep signup edits only the invited Local Agency entity and attached rep profile.
9. Staff signup can select existing agencies or create a new Local Agency.
10. Agency members see all agency requests, while `My Requests` limits to the logged-in rep.
11. FPU members see all agencies with agency/rep filters, while `My Requests` limits to handled agencies and explicitly related reps.
12. A request can be created through the form with known fields and generic fields.
13. A request row expands to show participant, agency, product, status, dates, ETA, comments, and attachment placeholders.
14. Summary filters update the displayed seeded metrics.
15. Admin can trigger an XLSX request-log download stub.
16. D1 migrations apply locally and API tests cover access requests, token validation, verification, approval/denial, request creation, and list retrieval.
17. Existing Nuxt build and Wrangler dry-run verification continue to pass.

## Future extension points

Production auth, invitation email delivery, R2 attachments, AI prescription
validation, diagnosis policy rules, accounting-specific McKesson fields, and
real capacity configuration should be added behind the existing auth, storage,
validation, report, and summary interfaces.
