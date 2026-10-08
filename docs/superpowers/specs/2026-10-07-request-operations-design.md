# Request Operations and Authorization Form Design

## Goal

Improve request review so staff can see the local agency and representative context, correct supplied prescription/request fields, allocate benefit quantities by month, and generate a PDF Authorization Form only after approval and product ordering.

## Scope

### Request list

- Keep the request type visible as a `New` or `Extension` chip in each list row.
- Remove the request number and `Rep #` from the list row.
- Keep the agency name, product, status, ETA, and tracking context.
- Format the status date as `Submitted MM/DD/YYYY`; use an em dash when no submission date exists.

### Request detail drawer

- Show the request number only in the drawer header.
- Show the request type chip in the drawer header/status area.
- Show local agency name and address, plus representative name, email, and phone.
- Show Benefits Start Date and Participant DOB with explicit labels.
- Allow staff to edit supplied request fields, including participant DOB, benefits start date, formula/form, amount prescribed, duration, diagnosis, and doctor/office fields. Save edits through the existing request update endpoint.
- Replace benefit issuance start/end month inputs with an ordered list of month rows. Each row has a month dropdown and quantity input. A plus button appends the next chronological month and selects it automatically. Duplicate months are prevented.
- Show the “Give reason” textarea only while the draft status is `denied`. Denying requires a non-empty reason; other statuses do not show that control.
- Show an Authorization Form PDF action only when `status === 'approved'` and `dateOrdered` is present.

### Authorization Form PDF

- Add `GET /api/requests/:id/authorization-form.pdf`.
- Return a static PDF generated on demand from the current request, agency, representative, and benefit allocation data.
- Include request metadata, participant details, agency/representative contact details, prescription details, approval/order details, and month/quantity allocations.
- Return a clear not-found error for an unknown request and a conflict-style error when the request is not approved or has no order date.
- Use the repository PDF workflow: generate with ReportLab, reopen/extract for content checks, render pages with Poppler, and visually inspect the rendered output.

## Data model

Add the following optional field to `RequestRecord`:

```ts
benefitIssuances?: Array<{ month: string; quantity: number }>;
```

The existing `benefitIssuanceStartMonth` and `benefitIssuanceEndMonth` fields remain optional for compatibility with seeded or previously stored records, but the new UI writes only `benefitIssuances`.

The existing `dateOrdered` field is the order-complete signal for Authorization Form availability. No separate order status is introduced in this change.

## Data lookup

The request list will resolve `agencyId` and `agencyMemberId` against the existing agency/member data and pass the matching records into the detail drawer. No denormalized contact snapshot is added to `RequestRecord`.

## Error handling

- Staff save failures remain inline in the drawer.
- Invalid benefit rows are rejected client-side: month is required, quantity must be a positive number, and months must be unique and chronological.
- The PDF endpoint returns HTTP 404 for missing requests and HTTP 409 for ineligible requests.

## Verification

- Unit tests cover month-row sequencing, duplicate prevention, and Authorization Form eligibility.
- UI contract tests cover list labels/chips, editable staff fields, denial-only reason visibility, and PDF action gating.
- PDF tests verify response type, eligibility behavior, and key text extraction.
- Run the full Vitest suite, production build, and PDF render/visual inspection before completion.

