export interface PoAllocationInput {productCode:string;casesApproved:number;casesAlreadyUsed:number;mcKessonPrice?:number}
export interface PoAllocation extends PoAllocationInput {productName:string;formulaDescription?:string;casesUsed:number;casesRemaining:number}
export interface PoInput {number:string;startDate:string;endDate:string;allocations:PoAllocationInput[]}
export interface PoOrderInput {id:string;requestId:number;productCode:string;cases:number;orderDate:string;poId:number}
export interface PoOrder extends PoOrderInput {status:'placed'|'cancelled';createdAt?:string;updatedAt?:string;version?:number}
export interface PurchaseOrder {id:number;number:string;startDate:string;endDate:string;allocations:PoAllocation[];orders:PoOrder[]}
export type PoPreview=Omit<PurchaseOrder,'id'|'orders'>;
export function poDate(value:unknown):value is string {return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function poToday():string {return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

export function isMcKessonPo(value?:string):boolean {return ['yes','y'].includes(value?.trim().toLowerCase()??'');}
