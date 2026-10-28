import type { RequestRecord } from './domain';
export type RequestShipment = NonNullable<RequestRecord['shipments']>[number];
export const blankShipment = (): RequestShipment => ({eta:'',casesShipped:0,carrier:'fedex',trackingNumbers:[]});
export function requestShipments(request: Partial<RequestRecord>): RequestShipment[] {
    if (request.shipments?.length) return request.shipments.map(row => ({...row,trackingNumbers:[...row.trackingNumbers]}));
    const carriers = [...new Set(request.trackingNumbers?.map(row => row.carrier) ?? [])];
    if (!carriers.length) carriers.push('fedex');
    return carriers.map((carrier,index) => ({eta:request.eta ?? '',casesShipped:index === 0 ? request.unitsIssued ?? 0 : 0,carrier,trackingNumbers:request.trackingNumbers?.filter(row => row.carrier === carrier).map(row => row.number) ?? []}));
}
export function validateShipments(rows: RequestShipment[], requireComplete = false): string {
    if (!Array.isArray(rows) || !rows.length) return 'Add a Shipment.';
    for (const [index,row] of rows.entries()) {
        const prefix = `Shipment ${index + 1}: `;
        if (!row || !['fedex','dhl','ups'].includes(row.carrier)) return prefix + 'Select a valid Carrier.';
        if (!Number.isInteger(row.casesShipped) || row.casesShipped < 0) return prefix + 'Cases Shipped must be a nonnegative whole number.';
        if (typeof row.eta !== 'string' || (row.eta && (!/^\d{4}-\d{2}-\d{2}$/.test(row.eta) || Number.isNaN(Date.parse(row.eta)) || new Date(row.eta).toISOString().slice(0,10) !== row.eta))) return prefix + 'Enter a valid ETA.';
        if (!Array.isArray(row.trackingNumbers) || row.trackingNumbers.some(number => typeof number !== 'string')) return prefix + 'Enter valid Tracking Numbers.';
        if ((requireComplete || row.etaSentAt) && (!row.eta || !row.trackingNumbers.some(number => number.trim()))) return prefix + 'Enter an ETA and at least one tracking number before marking the request as shipped.';
    }
    return '';
}
export function shipmentUpdates(rows: RequestShipment[]): Partial<RequestRecord> {
    const shipments = rows.map(row => ({...row,trackingNumbers:row.trackingNumbers.map(number => number.trim()).filter(Boolean)}));
    return {
        shipments,
        eta:shipments.map(row => row.eta).filter(Boolean).sort()[0] ?? '',
        unitsIssued:shipments.reduce((total,row) => total + row.casesShipped,0),
        trackingNumbers:shipments.flatMap(row => row.trackingNumbers.map(number => ({number,carrier:row.carrier}))),
    };
}
