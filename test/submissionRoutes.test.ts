import {it,expect,vi} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {persistSurplusSubmission} from '../server/utils/surplusReports';
import {getDemoUser} from '../server/utils/session';
import {submittedRequest} from '../server/utils/submittedRequests';
import type {RequestRecord} from '../shared/domain';
vi.stubGlobal('defineEventHandler',(fn:unknown)=>fn);
vi.stubGlobal('getRouterParam',()=> '1000998');
vi.stubGlobal('getHeader',(event:any)=>event.identity);
vi.stubGlobal('readBody',(event:any)=>event.body);
vi.stubGlobal('createError',(details:any)=>Object.assign(new Error(details.statusMessage),details));
const {default:put}=await import('../server/api/requests/[id].put');
const {default:get}=await import('../server/api/requests/[id].get');
async function fixture(){
 const {db}=surplusDb();
 const record={id:1000998,submissionId:'route-edit-test',agencyId:10,agencyMemberId:100,status:'unopened',participantName:'Synthetic Route'} as RequestRecord;
 await persistSurplusSubmission(db,record.submissionId!,record,getDemoUser('agency'));
 return {context:{cloudflare:{env:{CDPHWIC:db}}},identity:'agency',body:{},db};
}
it('rejects partial agency form edits without changing the saved form',async()=>{
 const event=await fixture();
 event.body={participantName:'Bypass'};
 await expect(put(event as never)).rejects.toMatchObject({statusCode:409});
 expect((await submittedRequest(event.db,1000998,getDemoUser('agency')))?.participantName).toBe('Synthetic Route');
});
it('allows operational receipt updates with an unchanged empty surplus list',async()=>{
 const event=await fixture();
 event.body={receivedStatus:'received',surplusItems:[],status:'complete'};
 const result=await put(event as never);
 expect(result.request.status).toBe('complete');
});
it('locks a submission when a reviewer reads its detail endpoint',async()=>{
 const event=await fixture();
 event.identity='internal';
 const result=await get(event as never);
 expect(result.request.status).toBe('opened');
 expect(result.request.openedAt).toBeTruthy();
});
