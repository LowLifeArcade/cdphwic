import type {RequestRecord} from './domain';
import type {RequestShipment} from './requestShipments';
export const validUnitSize=(n:unknown):n is number=>typeof n==='number' && Number.isSafeInteger(n) && n>0;
export const shipmentUnitSize=(row:RequestShipment):number=>validUnitSize(row.unitsPerCase)?row.unitsPerCase:1;
export function receiptQuantityKey(row:RequestShipment):string {return JSON.stringify([row.receivedCases ?? null,row.receivedUnits ?? null,row.damagedUnits ?? null,row.receivedAt ?? '',row.receiptConfirmed ?? false,row.dispositions ?? [],row.receiptCountHistory ?? [],row.receiptMode??null]);}
export function inputShipmentUnits(row:RequestShipment,cases:unknown,loose:unknown=0):number {
    const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:409,statusMessage:message});};
    if (typeof cases!=='number' || !Number.isSafeInteger(cases) || cases<0 || typeof loose!=='number' || !Number.isSafeInteger(loose) || loose<0) fail('Enter whole, nonnegative case and loose-unit quantities.');
    if (loose && !validUnitSize(row.unitsPerCase)) fail('CDPH/WIC must confirm Units per Case before recording loose or damaged units.');
    if (loose>=shipmentUnitSize(row)) fail('Loose units must be fewer than Units per Case.');
    const units=(cases as number)*shipmentUnitSize(row)+(loose as number);
    if (!Number.isSafeInteger(units)) fail('The quantity is too large.');
    return units;
}
export function shipmentQuantities(request:Partial<RequestRecord>,row:RequestShipment) {
    const size=shipmentUnitSize(row);
    const legacyConfirmed=!!row.receivedAt || !!row.receiptConfirmed || (request.receivedStatus==='received' && !request.shipments?.some(r=>r.receivedAt || r.receiptConfirmed || r.receivedUnits!==undefined));
    const receivedUnits=row.receivedUnits ?? (row.receivedCases!==undefined?row.receivedCases*size:legacyConfirmed && row.receiptMode!=='simple'?row.casesShipped*size:0);
    const disposedUnits=(row.dispositions ?? []).reduce((total,d)=>total+(d.units ?? d.cases*size),0);
    const disposedDamagedUnits=(row.dispositions ?? []).reduce((total,d)=>total+(d.damagedUnits ?? 0),0);
    const damagedUnits=row.damagedUnits ?? 0;
    const damagedHeldUnits=Math.max(0,damagedUnits-disposedDamagedUnits);
    return {size,receivedUnits,disposedUnits,disposedDamagedUnits,damagedUnits,damagedHeldUnits,usableUnits:receivedUnits-disposedUnits-damagedHeldUnits,expectedUnits:row.casesShipped*size+(row.looseUnitsShipped??0),missingUnits:Math.max(0,row.casesShipped*size+(row.looseUnitsShipped??0)-receivedUnits)};
}
export function formatShipmentUnits(units:number,size:number):string {
    const whole=Math.floor(units/size);const loose=units-whole*size;
    return `${whole} ${whole===1?'case':'cases'}${loose?` + ${loose} units`:''}`;
}
export function formatCaseEquivalent(value:number):string {return new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(value);}
