import type {RequestShipment} from './requestShipments';
export interface DistributorPolicy {labelsRequired:boolean;imagesRequired:boolean;replacementBasis:'units'|'cases';instructions:string}
export interface DistributorProfile extends DistributorPolicy {id:string;name:string;revision:number}
export interface DistributorSnapshot extends DistributorPolicy {distributorId:string;distributorName:string;revision:number}
export function validateDistributor(input:Partial<DistributorProfile>):string {
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200)return 'Enter a distributor name (200 characters or fewer).';
 if(typeof input.labelsRequired!=='boolean'||typeof input.imagesRequired!=='boolean'||!['units','cases'].includes(input.replacementBasis??'')||typeof input.instructions!=='string'||input.instructions.length>4000)return 'Choose label/image requirements, replacement basis, and instructions of 4,000 characters or fewer.';
 return '';
}
export function snapshotDistributor(profile:DistributorProfile|undefined):DistributorSnapshot|undefined {return profile?{distributorId:profile.id,distributorName:profile.name,revision:profile.revision,labelsRequired:profile.labelsRequired,imagesRequired:profile.imagesRequired,replacementBasis:profile.replacementBasis,instructions:profile.instructions}:undefined;}
export function damageEvidenceNeeded(row:RequestShipment):boolean {return (row.damagedUnits??0)>0||row.issue?.type==='damaged';}
export function showDamageRequirements(identity:string,row:RequestShipment,reportingDamage=false):boolean {return identity==='agency' && (reportingDamage||damageEvidenceNeeded(row));}
