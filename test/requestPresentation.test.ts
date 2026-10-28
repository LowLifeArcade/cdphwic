import { it, expect } from 'vitest';
import {
    requestFormulas,
    participantNames,
    insuranceLabel,
    foodRestrictionLabel,
    formulaOverviewUpdates,
} from '../shared/requestPresentation';
import type { RequestRecord } from '../shared/domain';
it('shows both submitted formulas with form, flavor, amount, and justification', () => {
    const formulas = [
        { productName: 'PediaSure', productForm: 'ready-to-feed', flavor: 'Vanilla', ouncesPrescribed: 20 },
        {
            productName: 'Other formula',
            otherFormulaName: 'Other formula',
            productForm: 'powder',
            ouncesPrescribed: 12,
            readyToFeedJustification: 'Saved reason',
        },
    ];
    expect(requestFormulas({ requestedFormulas: formulas, productName: 'stale' } as RequestRecord)).toEqual(formulas);
});
it('retains the saved fields on legacy single-formula requests', () => {
    expect(
        requestFormulas({
            productName: 'Nutramigen',
            productForm: 'ready-to-feed',
            ouncesPrescribed: 24,
            formulaFlavor: 'Vanilla',
            genericFields: { readyToFeedJustification: 'Cannot mix' },
        } as RequestRecord)[0],
    ).toMatchObject({
        productName: 'Nutramigen',
        productForm: 'ready-to-feed',
        ouncesPrescribed: 24,
        flavor: 'Vanilla',
        readyToFeedJustification: 'Cannot mix',
    });
    expect(participantNames({ participantName: 'Old Participant' } as RequestRecord)).toEqual({
        first: 'Old',
        last: 'Participant',
    });
    expect(
        participantNames({
            participantName: 'Legacy',
            participantFirstName: 'Entered',
            participantLastName: 'Name',
        } as RequestRecord),
    ).toEqual({ first: 'Entered', last: 'Name' });
});
it('uses form-facing labels for insurance and food restrictions', () => {
    expect(insuranceLabel('yes')).toBe('Medi-Cal');
    expect(insuranceLabel('no')).toBe('Private Insurance');
    expect(foodRestrictionLabel('not-indicated')).toBe('Neither box checked by HCP');
    expect(foodRestrictionLabel('under-6-months')).toBe('Participant is under 6 months');
});

it('keeps custom formula edits synchronized and preserves the second formula', () => {
    const second = { productName: 'Fortini', productForm: 'ready-to-feed', ouncesPrescribed: 12 };
    const draft = {
        productName: 'Custom B',
        productForm: 'powder',
        ouncesPrescribed: 24,
        durationMonths: 3,
        genericFields: { otherFormulaName: 'Custom A' },
        requestedFormulas: [
            { productName: 'Custom A', otherFormulaName: 'Custom A', productForm: 'powder', ouncesPrescribed: 24 },
            second,
        ],
    } as RequestRecord;
    const updates = formulaOverviewUpdates(draft);
    expect(updates.requestedFormulas?.[0]).toMatchObject({ productName: 'Custom B', otherFormulaName: 'Custom B' });
    expect(updates.genericFields?.otherFormulaName).toBe('Custom B');
    expect(updates.requestedFormulas?.[1]).toEqual(second);
    const catalog = formulaOverviewUpdates({ ...draft, productName: 'Fortini' });
    expect(catalog.requestedFormulas?.[0]?.otherFormulaName).toBeUndefined();
    expect(catalog.genericFields?.otherFormulaName).toBe('');
    expect(insuranceLabel('pending')).toBe('Pending');
});

it('combines Medi-Cal status and formats requested months like New Request', async () => {
    const { insuranceDetails, requestedMonthLabels } = await import('../shared/requestPresentation');
    expect(insuranceDetails({ medicalStatus: 'yes', mediCalStatus: 'Pending PA' })).toBe('Medi-Cal (Pending PA)');
    expect(insuranceDetails({ medicalStatus: 'no', mediCalStatus: 'Denied' })).toBe('Private Insurance');
    expect(requestedMonthLabels(['2026-01', '2026-03', '2026-12'])).toBe('JAN, MAR, DEC');
    expect(requestedMonthLabels([])).toBe('—');
});
it('formats Medi-Cal status in parentheses and puts city/state/ZIP on the second address line', async () => {
    const { insuranceDetails, providerAddressLines } = await import('../shared/requestPresentation');
    expect(insuranceDetails({ medicalStatus: 'yes', mediCalStatus: 'Denied' })).toBe('Medi-Cal (Denied)');
    expect(providerAddressLines('123 Main Street, Suite 2, San Luis Obispo, CA 93401')).toEqual([
        '123 Main Street, Suite 2',
        'San Luis Obispo, CA 93401',
    ]);
    expect(providerAddressLines('123 Main Street\nUkiah CA 95482')).toEqual(['123 Main Street', 'Ukiah, CA 95482']);
    expect(providerAddressLines('123 Main Street')).toEqual(['123 Main Street']);
});
