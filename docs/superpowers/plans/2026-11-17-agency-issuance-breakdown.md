# Local Agency issuance breakdown

Approved design: show formula metadata first, monthly approved quantities second, and a vertical source calculation last. Rename the displayed total to Total Unit(s) Approved. Show ordered cases converted to units and deduct Expected Surplus. Preserve existing monthly local surplus issuance actions.

1. Add a pure shared calculation with tests for whole-case excess (5 × 4 − 2 = 18), mixed sources, pending allocation, formula matching, and replacement exclusions.
2. Reorder RequestIssuanceSummary and render a responsive, accessible source calculation. Use saved source shipment quantities, not the combined approved order/transfer case count. Include published distributor shipments and authorized transfers; exclude replacement shipments. Unknown case sizes remain pending rather than being treated as one unit per case.
3. Run focused calculation and existing issuance tests, plus build verification. Review the diff for accidental changes to reviewer controls or surplus issue actions.

## Staff planning calculation (approved follow-up)
Show a live planning calculation for Admin and CDPH/WIC beneath existing allocation controls. Subtract local surplus and formula-matched transfer allocations from approved units, then calculate whole distributor cases needed and resulting expected surplus. Use draft values immediately; distinguish the recommended order plan from saved shipments. Preserve current save behavior and reviewer inputs.

1. Test planning calculations for 18 units / 4-unit cases, mixed surplus and transfers, multiple formulas, replacements, and unknown case size.
2. Add a staff planning component and connect it to the current draft and confirmed/catalog case size.
3. Run focused tests/build and inspect Admin and CDPH/WIC views. Show the result in the browser.
