import {expect, it} from 'vitest';
import type {RequestRecord} from '../shared/domain';
import {participantRequestHistory} from '../shared/requestHistory';
const row = (id:number, patch:Partial<RequestRecord> = {}) => ({id, agencyId:10, status:'complete', participantFamilyId:123, wicIndividualId:'01', participantName:'Jane Smith', participantDob:'2020-01-01', submissionDate:'2026-01-01', ...patch}) as RequestRecord;
const input = {familyId:'123', individualId:'01', name:' jane  SMITH ', dob:'2020-01-01'};
it('matches both IDs and includes completed history newest first', () => {
    const result = participantRequestHistory([row(1),row(2,{submissionDate:'2026-02-01'}),row(3,{wicIndividualId:'02',participantName:'Other'})], input);
    expect(result.matches.map(r=>r.id)).toEqual([2,1]);
    expect(result.warnings).toEqual([]);
});
it('warns about changed name or DOB without treating formatting as a mismatch', () => {
    expect(participantRequestHistory([row(1)], {...input, name:'Janet Smith'}).warnings).toHaveLength(1);
    expect(participantRequestHistory([row(1)], {...input, dob:'2020-02-01'}).warnings).toHaveLength(1);
});
it('keeps name and DOB candidates separate from confirmed ID matches', () => {
    const result = participantRequestHistory([row(1,{wicIndividualId:'02'}),row(2,{participantDob:'2021-01-01',wicIndividualId:'03'})], input);
    expect(result.matches).toEqual([]);
    expect(result.possibleMatches.map(r=>r.id)).toEqual([1]);
    expect(result.warnings).toHaveLength(2);
});
it('does not guess from names alone or missing IDs; excludes drafts, current and later requests', () => {
    expect(participantRequestHistory([row(1)], {...input, familyId:''}).matches).toEqual([]);
    const result = participantRequestHistory([row(1),row(2,{status:'incomplete'}),row(3,{submissionDate:'2026-03-01'})], {...input, currentId:1, before:'2026-02-01'});
    expect(result.matches).toEqual([]);
    expect(participantRequestHistory([row(1)], {...input, individualId:'02',dob:''}).possibleMatches).toEqual([]);
});
