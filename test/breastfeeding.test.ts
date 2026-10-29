import {expect,it} from 'vitest';
import {breastfeedingOptions,validateBreastfeeding} from '../shared/breastfeeding';
import {restoreSubmittedForm,submissionFields} from '../shared/requestEditing';

it('offers the requested choices and requires a valid date only for discontinued breastfeeding', () => {
    expect(breastfeedingOptions).toEqual(['Fully BF','Never BF','Breastmilk + Formula','Discontinued BF']);
    expect(validateBreastfeeding({})).toBe('');
    for (const status of breastfeedingOptions.slice(0,3)) expect(validateBreastfeeding({breastfeedingStatus:status})).toBe('');
    expect(validateBreastfeeding({breastfeedingStatus:'Discontinued BF'})).toBe('Enter Date Discontinued.');
    expect(validateBreastfeeding({breastfeedingStatus:'Discontinued BF',breastfeedingDiscontinuedDate:'2026-02-30'})).toBe('Enter a valid Date Discontinued.');
    expect(validateBreastfeeding({breastfeedingStatus:'Discontinued BF',breastfeedingDiscontinuedDate:'2026-10-01'})).toBe('');
    expect(validateBreastfeeding({breastfeedingStatus:'invalid'})).not.toBe('');
});

it('persists breastfeeding information, restores it for submission editing, and clears an obsolete date', async () => {
    const {surplusDb} = await import('./helpers/surplusDb');
    const {ensureSubmittedRequest,updateSubmittedRequest} = await import('../server/utils/submittedRequests');
    const {db} = surplusDb();
    const previous = await ensureSubmittedRequest(db,{id:9040,submissionId:'breastfeeding-test',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'opened'});
    await expect(updateSubmittedRequest(db,previous,{breastfeedingStatus:'Discontinued BF'})).rejects.toMatchObject({statusCode:400});
    const fields = {breastfeedingStatus:'Discontinued BF' as const,breastfeedingDiscontinuedDate:'2026-10-01'};
    const saved = await updateSubmittedRequest(db,previous,submissionFields(fields));
    expect(restoreSubmittedForm(saved).form).toMatchObject(fields);
    const updated = await updateSubmittedRequest(db,saved,{breastfeedingStatus:'Fully BF'});
    expect(updated.breastfeedingStatus).toBe('Fully BF');
    expect(updated.breastfeedingDiscontinuedDate).toBe('');
});
