import type { ProductForm, ProductRecord, SessionUser } from './domain';
import type {ClinicAddress} from './shipping';
export interface SurplusVariant {
    clinicId?:string;
    formulaName: string;
    form: string;
    flavor: string;
    expirationDate: string;
}
export interface SurplusLot extends SurplusVariant {
    clinicName?:string;
    clinicAddress?:ClinicAddress;
    id: string;
    agencyId: number;
    onHand: number;
    reserved: number;
    expiredUnits: number;
    version: number;
}
export interface SurplusCommand {
    clinicId?:string;
    operationId: string;
    kind: 'reconcile' | 'deduct' | 'reserve' | 'ship' | 'receive' | 'cancel' | 'expire' | 'correct-expiry' | 'correct-entry';
    lotId: string;
    correctionOf?: string;
    correctedFormulaName?:string;
    correctedForm?:ProductForm;
    correctedFlavor?:string;
    correctedExpirationDate?:string;
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
export interface SurplusCatalogVariant {formulaName:string;form:ProductForm;flavor:string;packagings:string[]}
export function surplusCatalogVariants(products:ProductRecord[]=[]):SurplusCatalogVariant[]{
    const variants=new Map<string,SurplusCatalogVariant>();
    for(const product of products){
        const formulaName=product.name.trim().replace(/\s+/g,' ');
        const form=product.form;
        if(product.active===false||!formulaName||!['powder','concentrate','ready-to-feed'].includes(form))continue;
        const flavor=(product.flavor??'').trim().replace(/\s+/g,' ');
        const packaging=(product.packaging??'').trim().replace(/\s+/g,' ');
        const key=JSON.stringify([normalizeVariantText(formulaName),form,normalizeVariantText(flavor)]);
        const existing=variants.get(key);
        if(existing){if(!existing.packagings.some(value=>normalizeVariantText(value)===normalizeVariantText(packaging)))existing.packagings.push(packaging);}
        else variants.set(key,{formulaName,form:form as ProductForm,flavor,packagings:[packaging]});
    }
    return [...variants.values()].sort((a,b)=>a.formulaName.localeCompare(b.formulaName)||a.form.localeCompare(b.form)||a.flavor.localeCompare(b.flavor));
}
export function defaultSurplusCatalogOption<T>(options:readonly T[]):T|undefined{return options.length===1?options[0]:undefined;}
export const variantKey = (v: SurplusVariant) =>
    JSON.stringify([normalizeVariantText(v.formulaName), v.form, normalizeVariantText(v.flavor), v.expirationDate]);
export const lotKey = (v: SurplusVariant) => v.clinicId
    ? JSON.stringify([...JSON.parse(variantKey(v)),v.clinicId]) : variantKey(v);
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
    return !validateUnits(quantity) && daysRemaining(lot.expirationDate, today) > 60 && availableUnits(lot) >= quantity;
}
export interface SurplusReport {
    clinic_id?:string;
    clinic_name?:string;
    clinic_address?:string;
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
    clinic_id?:string;
    clinic_name?:string;
    clinic_address?:string;
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
    source_clinic_id?:string;
    source_clinic_name?:string;
    source_clinic_address?:string;
    stock_confirmed_at?:string;
    stock_confirmed_by?:number;
    requested_label_count?:number;
    shipped_date?:string;
    received_date?:string;
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
