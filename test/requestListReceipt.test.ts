import {expect,it} from 'vitest';
import {formatEtaDate} from '../shared/requestPresentation';

it('formats list ETAs as MM-DD-YYYY without changing date-only values by timezone', () => {
    expect(formatEtaDate('2026-01-09')).toBe('01-09-2026');
    expect(formatEtaDate('2027-12-31')).toBe('12-31-2027');
    expect(formatEtaDate()).toBe('—');
});

it('confirms receipt without replacing shipment details, notes, or uploaded evidence', async () => {
    const {surplusDb} = await import('./helpers/surplusDb');
    const {ensureSubmittedRequest,updateSubmittedRequest,submittedRequest} = await import('../server/utils/submittedRequests');
    const {getDemoUser} = await import('../server/utils/session');
    const {db} = surplusDb();
    const previous = await ensureSubmittedRequest(db,{id:9041,submissionId:'list-receipt-test',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'shipped',receivedStatus:'shipped',repNotes:'Keep these notes',receivedPhotos:['evidence.png'],shipments:[{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']},{eta:'2026-11-03',casesShipped:3,carrier:'fedex',trackingNumbers:['B']}]});
    await updateSubmittedRequest(db,previous,{receivedStatus:'received',status:'complete'});
    const saved = await submittedRequest(db,9041,getDemoUser('admin'));
    expect(saved).toMatchObject({status:'complete',receivedStatus:'received',repNotes:'Keep these notes',receivedPhotos:['evidence.png'],shipments:previous.shipments});
});
