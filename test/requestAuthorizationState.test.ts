import { afterEach, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { useAuthorizationEditor } from '../app/features/requests/composables/useAuthorizationEditor';
import type { RequestRecord } from '../shared/domain';

function setup() {
    const draft = reactive<Partial<RequestRecord>>({ formulaAuthorizations: [{ productName: 'Fortini', productForm: 'powder', unitsPerCase: 6, benefitIssuances: [{ month: '2026-11', quantity: 10 }], localSurplusAllocations: [{ lotId: 'lot', units: 3 }] }] });
    return { draft, row: draft.formulaAuthorizations![0]!, editor: useAuthorizationEditor(draft, () => [], () => draft) };
}
afterEach(() => vi.useRealTimers());
it('recalculates approved units, subtracts on-hand assignments, rounds cases and retains the fulfillment choice', () => {
    const { row, editor } = setup();
    editor.recalculateAuthorizationCases(0);
    expect(row).toMatchObject({ totalUnitsIssued: 10, approvedMonths: 1, unitsToOrder: 7, approvedCases: 2, standardCases: 2, specialOrderCases: 0 });
    editor.setLocalSurplusAllocation(row, 'lot', 10);
    expect(row).toMatchObject({ unitsToOrder: 0, approvedCases: 0 });
    editor.setLocalSurplusAllocation(row, 'lot', 0);
    expect(row.localSurplusAllocations).toEqual([]); expect(row.unitsToOrder).toBe(10);
});
it('keeps historical issuance months visible, adds only within the current window, and recomputes after removal', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    const { row, editor } = setup();
    row.benefitIssuances = [{ month: '2025-01', quantity: 8 }];
    expect(editor.issuanceMonthOptions(row).some(month => month.value === '2025-01')).toBe(true);
    editor.addBenefitMonth(0); expect(row.benefitIssuances).toHaveLength(1);
    row.benefitIssuances = [{ month: '2026-11', quantity: 8 }];
    expect(editor.canAddIssuanceMonth(row)).toBe(true);
    editor.addBenefitMonth(0); expect(row.benefitIssuances[1]).toEqual({ month: '2026-12', quantity: 0 });
    editor.removeBenefitMonth(0, 0); expect(row.totalUnitsIssued).toBe(0); expect(row.approvedMonths).toBe(0);
});
