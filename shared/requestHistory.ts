import type {RequestRecord} from './domain';
export interface ParticipantHistoryInput {familyId:string; individualId:string; name:string; dob:string; currentId?:number; before?:string;}
export interface ParticipantHistory {matches:RequestRecord[]; possibleMatches:RequestRecord[]; warnings:string[];}
const normalizedName = (name:string) => name.trim().replace(/\s+/g,' ').toLowerCase();
export function participantRequestHistory(requests:RequestRecord[], input:ParticipantHistoryInput):ParticipantHistory {
    const result:ParticipantHistory = {matches:[],possibleMatches:[],warnings:[]};
    if (!input.familyId.trim() || !input.individualId.trim()) return result;
    const rows = requests.filter(r => r.status !== 'incomplete' && r.id !== input.currentId && (!input.before || !r.submissionDate || r.submissionDate <= input.before))
        .sort((a,b)=>(b.submissionDate??'').localeCompare(a.submissionDate??'') || b.id-a.id);
    for (const row of rows) {
        if (row.participantFamilyId !== undefined && String(row.participantFamilyId) === String(Number(input.familyId)) && row.wicIndividualId?.trim() === input.individualId.trim()) result.matches.push(row);
        else if (input.name.trim() && input.dob && normalizedName(row.participantName) === normalizedName(input.name) && row.participantDob === input.dob) result.possibleMatches.push(row);
    }
    if (result.matches.some(r => (input.name.trim() && normalizedName(r.participantName) !== normalizedName(input.name)) || (input.dob && r.participantDob && r.participantDob !== input.dob)))
        result.warnings.push('These WIC IDs match prior requests with different participant details. Please double-check your entries.');
    if (!result.matches.length) result.warnings.push('No prior requests found for these WIC IDs. Please double-check both IDs before continuing.');
    if (result.possibleMatches.length) result.warnings.push('A prior request may belong to this participant, but the WIC IDs differ. Please verify your entries.');
    return result;
}
