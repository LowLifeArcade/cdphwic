import { expect, it } from 'vitest';
import { requestShipments, shipmentUpdates, validateShipments } from '../shared/requestShipments';

it('restores existing single-shipment data without losing carrier or tracking numbers', () => {
    expect(requestShipments({eta:'2026-11-01',unitsIssued:3,trackingNumbers:[{number:'A',carrier:'ups'}]})).toEqual([{eta:'2026-11-01',casesShipped:3,carrier:'ups',trackingNumbers:['A']}]);
});
it('keeps shipment details separate and supplies summary fields for existing views', () => {
    const shipments = [{unitsPerCase:6,eta:'2026-11-02',casesShipped:2,carrier:'ups' as const,trackingNumbers:[' A ']},{eta:'2026-11-01',casesShipped:3,carrier:'fedex' as const,trackingNumbers:['B']}];
    const updates = shipmentUpdates(shipments);
    expect(updates.eta).toBe('2026-11-01');
    expect(updates.unitsIssued).toBe(5);
    expect(updates.trackingNumbers).toEqual([{number:'A',carrier:'ups'},{number:'B',carrier:'fedex'}]);
    expect(requestShipments(updates)).toEqual(updates.shipments);
    shipments[0]!.trackingNumbers.push('C');
    expect(updates.shipments![0]!.trackingNumbers).toEqual(['A']);
});
it('permits saving incomplete shipments but requires every ETA and tracking number to mark shipped', () => {
    const rows = [{eta:'',casesShipped:0,carrier:'ups' as const,trackingNumbers:[]}];
    expect(validateShipments(rows)).toBe('');
    expect(validateShipments(rows,true)).toContain('Shipment 1');
    expect(validateShipments([{...rows[0]!,casesShipped:-1}])).toContain('Cases Shipped');
    expect(validateShipments([{...rows[0]!,eta:'2026-02-30'}])).toContain('ETA');
    expect(validateShipments([{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A']},...rows],true)).toContain('Shipment 2');
});

it('persists both shipment sets and rejects incomplete shipped records at the server boundary', async () => {
    const {surplusDb} = await import('./helpers/surplusDb');
    const {ensureSubmittedRequest,updateSubmittedRequest,submittedRequests} = await import('../server/utils/submittedRequests');
    const {getDemoUser} = await import('../server/utils/session');
    const {db} = surplusDb();
    const previous = await ensureSubmittedRequest(db,{id:9020,submissionId:'two-shipment-test',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
    const shipments = [{unitsPerCase:6,eta:'2026-11-02',casesShipped:2,carrier:'ups' as const,trackingNumbers:['A']},{eta:'2026-11-03',casesShipped:3,carrier:'fedex' as const,trackingNumbers:['B']}];
    const saved = await updateSubmittedRequest(db,previous,{shipments});
    expect((await submittedRequests(db,getDemoUser('admin')))[0]!.shipments).toEqual(shipments);
    expect(saved.unitsIssued).toBe(5);
    await expect(updateSubmittedRequest(db,saved,{status:'shipped',shipments:[shipments[0]!,{...shipments[1]!,eta:''}]})).rejects.toMatchObject({statusCode:400});
    expect((await submittedRequests(db,getDemoUser('admin')))[0]!.status).toBe('in_progress');
});

it('sends one shipment ETA without requiring or marking the other shipment sent', async () => {
    const {surplusDb} = await import('./helpers/surplusDb');
    const {ensureSubmittedRequest,updateSubmittedRequest} = await import('../server/utils/submittedRequests');
    const {db} = surplusDb();
    const previous = await ensureSubmittedRequest(db,{id:9021,submissionId:'independent-etas',agencyId:10,agencyMemberId:100,participantName:'Example',productName:'Example',status:'in_progress'});
    const shipments = [{unitsPerCase:6,eta:'2026-11-02',casesShipped:2,carrier:'ups' as const,trackingNumbers:['A']},{unitsPerCase:6,eta:'',casesShipped:0,carrier:'fedex' as const,trackingNumbers:[]}];
    const first = await updateSubmittedRequest(db,previous,{shipments},false,0);
    expect(first.shipments![0]!.etaSentAt).toBeTruthy();
    expect(first.shipments![1]!.etaSentAt).toBeUndefined();
    expect(first.status).toBe('in_progress');
    await expect(updateSubmittedRequest(db,first,{shipments:first.shipments},false,1)).rejects.toMatchObject({statusCode:400});
    const second = await updateSubmittedRequest(db,first,{shipments:[first.shipments![0]!,{...first.shipments![1]!,eta:'2026-11-03',trackingNumbers:['B']}]},false,1);
    expect(second.shipments!.every(row => row.etaSentAt)).toBe(true);
    expect(second.status).toBe('shipped');
});
it('preserves a shipment supplier with ETA information and normalizes surrounding spaces',()=>{
 const saved=shipmentUpdates([{eta:'2026-11-01',casesShipped:2,carrier:'ups',trackingNumbers:['A'],supplier:'  Example Supplier  '}]);
 expect(saved.shipments![0]!.supplier).toBe('Example Supplier');
});
