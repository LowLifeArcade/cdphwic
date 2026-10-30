import type { SessionUser } from './domain';
export interface SurplusVariant {
    formulaName: string;
    form: string;
    flavor: string;
    expirationDate: string;
}
export interface SurplusLot extends SurplusVariant {
    id: string;
    agencyId: number;
    onHand: number;
    reserved: number;
    expiredUnits: number;
    version: number;
}
export interface SurplusCommand {
    operationId: string;
    kind: 'reconcile' | 'deduct' | 'reserve' | 'ship' | 'receive' | 'cancel' | 'expire' | 'correct-expiry';
    lotId: string;
    quantity?: number;
    destinationAgencyId?: number;
    transferId?: string;
    requestRef?: string;
    reason?: string;
    expectedVersion?: number;
    reportId?: string;
    date?: string;
    trackingReference?: string;
    expirationDate?: string;
    confirmerName?: string;
}
export const isReviewer = (user: SessionUser) => user.role === 'admin' || user.memberType === 'internal';
export const canSeeAgency = (user: SessionUser, agencyId: number) => isReviewer(user) || user.agencyId === agencyId;
export const normalizeVariantText = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
export const variantKey = (v: SurplusVariant) =>
    JSON.stringify([normalizeVariantText(v.formulaName), v.form, normalizeVariantText(v.flavor), v.expirationDate]);
export const availableUnits = (lot: Pick<SurplusLot, 'onHand' | 'reserved' | 'expiredUnits'>) =>
    Math.max(0, lot.onHand - lot.reserved);
export const validateUnits = (n: number) =>
    Number.isSafeInteger(n) && n > 0 ? '' : 'Enter a positive whole number of units.';
export function localDate(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}
export function validDate(s: string) {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(s)) &&
        new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
    );
}
export function daysRemaining(expiry: string, today: string) {
    return validDate(expiry) && validDate(today)
        ? Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
        : NaN;
}
export function canAllocate(
    lot: Pick<SurplusLot, 'onHand' | 'reserved' | 'expiredUnits' | 'expirationDate'>,
    quantity: number,
    today: string,
) {
    return !validateUnits(quantity) && daysRemaining(lot.expirationDate, today) >= 0 && availableUnits(lot) >= quantity;
}
export interface SurplusReport {
    id: string;
    agency_id: number;
    formula_name: string;
    form: string;
    flavor: string;
    expiration_date: string;
    reported_units: number;
    status: string;
    request_ref: string;
    counted_at: string;
    confirmer_name: string;
    reason: string;
}
export interface SurplusForecast {
    id: string;
    agency_id: number;
    request_ref: string;
    formula_name: string;
    form: string;
    flavor: string;
    expected_units: number;
    due_date: string;
    status: string;
    actual_units: number | null;
    report_id: string | null;
}
export interface SurplusTransfer {
    request_id?:number;
    units_per_case?:number;
    eta?:string;
    carrier?:string;
    destination_shipping?:string;
    received_units?:number;
    damaged_units?:number;
    id: string;
    source_lot_id: string;
    source_agency_id: number;
    destination_agency_id: number;
    quantity: number;
    request_ref: string;
    status: string;
    formula_name: string;
    form: string;
    flavor: string;
    expiration_date: string;
    tracking_reference: string;
}
export interface SurplusMovement {
    id: string;
    operation_id: string;
    lot_id: string;
    kind: string;
    quantity: number;
    actor_id: number;
    request_ref: string;
    reason: string;
    on_hand: number;
    reserved: number;
    expired_units: number;
    created_at: string;
    agency_id: number;
    formula_name: string;
    form: string;
    flavor: string;
}
