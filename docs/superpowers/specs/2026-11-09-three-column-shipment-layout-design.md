# Formula Issuance and Shipment Layout Design

## Intent

Remove repeated shipment information from the Authorization form by placing each formula's shipment details beside its monthly issuance block. Keep Local Agency details visible below, and increase Next Steps body text slightly for readability.

## Goals

- In the Monthly Formula Issuance section, keep monthly quantities in the left three-quarters and show the formula's Source, ETA, Carrier, and Tracking in the right quarter.
- Match each shipment panel to its formula, including shipments without an explicit formula association where the request has only one formula.
- Remove the separate Shipment Details block from Authorization downloads; keep Local Agency details below.
- Preserve the existing Shipment Details layout for Shipment Confirmation downloads.
- Increase Next Steps body text modestly while preserving wrapping and pagination.
- Preserve shipment-confirmation quantities and all existing authorization content.

## Non-goals and constraints

- Do not change shipment calculations, authorization metrics, or receipt signatures.
- Do not force long tracking data or other variable text to fit by clipping or shrinking it excessively; it may wrap and continue onto another page.
- Keep the existing portrait page and PDF generation library.

## Approaches

- **Selected: 75/25 formula issuance split.** Each formula keeps its metrics and monthly quantity rows in a 75% column, with Source, ETA, Carrier, and Tracking beside them in the remaining 25%. This makes issuance and its related shipment readable as one unit and removes repeated shipment details below.
- **Keep shipment details in a separate section.** Rejected because it repeats formula shipment context after the issuance metrics and separates it from monthly quantities.
- **Use a full-width shipment panel.** Rejected because shipment details do not need the whole row and would force monthly quantities back into a separate full-width band.

## Implementation notes

- Update the authorization PDF generator and its tests only.
- Use shipments associated with each formula to populate its right-hand panel.
- Keep the separate shipment details layout for shipment-confirmation PDFs.
- Set Next Steps body text to 11 pt with line spacing adjusted for the larger text.
- Keep the existing two-column rendering path for one formula.
- Verify both one- and two-formula layouts, long wrapped details, shipment-confirmation output, the full test suite, production build, and rendered PDF previews.
