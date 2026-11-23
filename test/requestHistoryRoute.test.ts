import {it,expect,vi} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {ensureSubmittedRequest,submittedRequest} from '../server/utils/submittedRequests';
import {getDemoUser} from '../server/utils/session';
import type {RequestRecord} from '../shared/domain';
vi.stubGlobal('defineEventHandler',(fn:unknown)=>fn);
vi.stubGlobal('getHeader',(event:any)=>event.identity);
vi.stubGlobal('readBody',(event:any)=>event.body);
vi.stubGlobal('createError',(details:any)=>Object.assign(new Error(details.statusMessage),details));
const {default:history}=await import('../server/api/requests/history.post');
async function fixture() {
    const {db}=surplusDb();
    const agency=getDemoUser('agency').agencyId!;
    for(const [id,agencyId,status] of [[99101,agency,'complete'],[99102,999,'complete'],[99103,agency,'unopened']] as const)
        await ensureSubmittedRequest(db,{id,submissionId:`history-${id}`,agencyId,agencyMemberId:100,participantFamilyId:812345,wicIndividualId:'07',participantName:'History Test',participantDob:'2020-01-01',status,submissionDate:id===99103?'2026-02-01':'2026-01-01'} as RequestRecord);
    return {db,identity:'agency',context:{cloudflare:{env:{CDPHWIC:db}}},body:{familyId:'812345',individualId:'07',name:'History Test',dob:'2020-01-01'} as Record<string,unknown>};
}
it('never discloses another agency’s exact or possible matches',async()=>{
    const event=await fixture();
    expect((await history(event as never)).matches.map(r=>r.id)).toEqual([99103,99101]);
    event.body.individualId='08';
    expect((await history(event as never)).possibleMatches.map(r=>r.id)).toEqual([99103,99101]);
});
it('allows Admin history and leaves unread submissions unchanged',async()=>{
    const event=await fixture();event.identity='admin';
    expect((await history(event as never)).matches.map(r=>r.id)).toEqual([99103,99102,99101]);
    expect((await submittedRequest(event.db,99103,getDemoUser('admin')))?.status).toBe('unopened');
});
it('uses stored identifiers for current requests and rejects inaccessible current IDs',async()=>{
    const event=await fixture();event.body.currentId=99103;event.body.familyId='wrong';
    expect((await history(event as never)).matches.map(r=>r.id)).toEqual([99101]);
    event.body.currentId=99102;
    await expect(history(event as never)).rejects.toMatchObject({statusCode:404});
});
it('rejects malformed lookup inputs',async()=>{
    const event=await fixture();event.body.familyId={bad:true};
    await expect(history(event as never)).rejects.toMatchObject({statusCode:400});
});

it('limits CDPH/WIC history to their assigned agencies',async()=>{
    const event=await fixture();event.identity='internal';
    expect((await history(event as never)).matches.map(r=>r.id)).toEqual([99103,99101]);
});
