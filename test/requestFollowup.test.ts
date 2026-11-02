import {it,expect} from 'vitest';
import {surplusDb} from './helpers/surplusDb';
import {getDemoUser} from '../server/utils/session';
import {ensureSubmittedRequest,requestMoreInfo,updateSubmittedRequest} from '../server/utils/submittedRequests';
it('sends required reviewer notes with revision protection and preserves Pending LA during other updates',async()=>{
 const {db}=surplusDb();const previous=await ensureSubmittedRequest(db,{id:9933,submissionId:'followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 await expect(requestMoreInfo(db,previous,getDemoUser('agency'),'Missing date',previous.revision??0)).rejects.toMatchObject({statusCode:403});
 await expect(requestMoreInfo(db,previous,getDemoUser('internal'),' ',previous.revision??0)).rejects.toMatchObject({statusCode:400});
 const sent=await requestMoreInfo(db,previous,getDemoUser('internal'),'Please provide Date Signed.',previous.revision??0);
 expect(sent.status).toBe('needs_info');expect(sent.moreInfoRequests?.[0]?.notes).toBe('Please provide Date Signed.');
 await expect(requestMoreInfo(db,sent,getDemoUser('internal'),'Again',0)).rejects.toMatchObject({statusCode:409});
 const updated=await updateSubmittedRequest(db,sent,{status:'in_progress'});expect(updated.status).toBe('needs_info');
});
it('publishes immutable authorization versions and scopes notices to the request agency',async()=>{
 const {requestNotices}=await import('../server/utils/requestNotices');
 const {db}=surplusDb();const previous=await ensureSubmittedRequest(db,{id:9934,submissionId:'publish',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',productForm:'ready-to-feed',status:'in_progress',nextSteps:'Published instruction'});
 const sent=await updateSubmittedRequest(db,previous,{shipmentDrafts:[{eta:'2026-11-10',carrier:'ups',casesShipped:2,trackingNumbers:['ONE']}]},false,0,3,undefined,false);
 expect(sent.authorizationVersions).toHaveLength(1);expect(sent.authorizationVersions![0]!.record.shipmentDrafts).toBeUndefined();
 const changed=await updateSubmittedRequest(db,sent,{nextSteps:'Unsent revision'});expect(changed.authorizationVersions![0]!.record.nextSteps).toBe('Published instruction');
 const notices=await requestNotices(db,getDemoUser('agency'));expect(notices).toHaveLength(1);expect(notices[0]?.version_id).toBe(sent.authorizationVersions![0]!.id);
 expect(await requestNotices(db,{...getDemoUser('agency'),agencyId:11})).toHaveLength(0);
 const pending=await requestMoreInfo(db,changed,getDemoUser('internal'),'Please correct date',changed.revision!);
 expect((await requestNotices(db,getDemoUser('agency'))).some(n=>n.kind==='request-info'&&n.notes==='Please correct date')).toBe(true);
 await db.prepare('INSERT INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)').bind(`followup:${pending.moreInfoRequests![0]!.id}`,getDemoUser('agency').id).run();
 expect((await requestNotices(db,getDemoUser('agency'))).find(n=>n.kind==='request-info')?.is_read).toBe(1);
});
it('allows reviewers to edit or remove notes with revision checks while preserving the return workflow',async()=>{
 const {editMoreInfoNote}=await import('../server/utils/submittedRequests');
 const {requestNotices}=await import('../server/utils/requestNotices');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{id:9935,submissionId:'edit-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 const sent=await requestMoreInfo(db,original,getDemoUser('internal'),'Original note',0);const id=sent.moreInfoRequests![0]!.id;
 await expect(editMoreInfoNote(db,sent,getDemoUser('agency'),{noteId:id,action:'edit',notes:'Unauthorized'},sent.revision!)).rejects.toMatchObject({statusCode:403});
 await expect(editMoreInfoNote(db,sent,getDemoUser('internal'),{noteId:id,action:'edit',notes:' '},sent.revision!)).rejects.toMatchObject({statusCode:400});
 const edited=await editMoreInfoNote(db,sent,getDemoUser('internal'),{noteId:id,action:'edit',notes:'Corrected note'},sent.revision!);
 expect(edited.moreInfoRequests![0]!.notes).toBe('Corrected note');expect(edited.status).toBe('needs_info');expect((await requestNotices(db,getDemoUser('agency')))[0]?.notes).toBe('Corrected note');
 await expect(editMoreInfoNote(db,edited,getDemoUser('admin'),{noteId:id,action:'delete'},sent.revision!)).rejects.toMatchObject({statusCode:409});
 const deleted=await editMoreInfoNote(db,edited,getDemoUser('admin'),{noteId:id,action:'delete'},edited.revision!);
 expect(deleted.moreInfoRequests![0]!.deletedAt).toBeTruthy();expect(deleted.status).toBe('needs_info');expect(await requestNotices(db,getDemoUser('agency'))).toHaveLength(0);
 const {canEditSubmission}=await import('../shared/requestEditing');expect(canEditSubmission(deleted)).toBe(false);
});
it('lets the request agency answer an active note without clearing the return status and notifies reviewers',async()=>{
 const {replyToMoreInfo}=await import('../server/utils/submittedRequests');const {requestNotices}=await import('../server/utils/requestNotices');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{id:9936,submissionId:'reply-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 const pending=await requestMoreInfo(db,original,getDemoUser('internal'),'Please clarify.',0);const noteId=pending.moreInfoRequests![0]!.id;
 await expect(replyToMoreInfo(db,pending,{...getDemoUser('agency'),agencyId:11},{noteId,notes:'Wrong agency'},pending.revision!)).rejects.toMatchObject({statusCode:404});
 await expect(replyToMoreInfo(db,pending,getDemoUser('agency'),{noteId,notes:' '},pending.revision!)).rejects.toMatchObject({statusCode:400});
 const replied=await replyToMoreInfo(db,pending,getDemoUser('agency'),{noteId,notes:'The corrected form is ready.'},pending.revision!);
 expect(replied.status).toBe('needs_info');expect(replied.moreInfoRequests![0]!.responses?.[0]?.notes).toBe('The corrected form is ready.');
 const notices=await requestNotices(db,getDemoUser('internal'));expect(notices.some(n=>n.kind==='request-response'&&n.notes==='The corrected form is ready.')).toBe(true);
 expect((await requestNotices(db,getDemoUser('agency'))).some(n=>n.kind==='request-response')).toBe(false);
 await expect(replyToMoreInfo(db,replied,getDemoUser('agency'),{noteId,notes:'Stale'},pending.revision!)).rejects.toMatchObject({statusCode:409});
});
it('lets CDPH/WIC and Admin resolve followups, preserving history and ending agency correction access',async()=>{
 const {resolveMoreInfo,replyToMoreInfo}=await import('../server/utils/submittedRequests');
 const {hasPendingMoreInfo,canEditSubmission}=await import('../shared/requestEditing');
 const {requestNotices}=await import('../server/utils/requestNotices');
 for(const role of ['internal','admin'] as const){
  const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{id:9937,submissionId:'resolve-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
  const pending=await requestMoreInfo(db,original,getDemoUser('internal'),'Please clarify.',0);
  const noteId=pending.moreInfoRequests![0]!.id;
  const replied=await replyToMoreInfo(db,pending,getDemoUser('agency'),{noteId,notes:'Clarification provided.'},pending.revision!);
  await expect(resolveMoreInfo(db,replied,getDemoUser('agency'),replied.revision!)).rejects.toMatchObject({statusCode:403});
  await expect(resolveMoreInfo(db,replied,getDemoUser(role),pending.revision!)).rejects.toMatchObject({statusCode:409});
  const resolved=await resolveMoreInfo(db,replied,getDemoUser(role),replied.revision!);
  expect(resolved.status).toBe('in_progress');expect(resolved.moreInfoRequests![0]!.resolvedAt).toBeTruthy();expect(resolved.moreInfoRequests![0]!.resolvedBy).toBe(getDemoUser(role).id);
  expect(resolved.moreInfoRequests![0]!.responses![0]!.notes).toBe('Clarification provided.');expect(hasPendingMoreInfo(resolved)).toBe(false);expect(canEditSubmission(resolved)).toBe(false);
  expect((await requestNotices(db,getDemoUser('agency'))).some(n=>n.kind==='request-info')).toBe(false);
  await expect(replyToMoreInfo(db,resolved,getDemoUser('agency'),{noteId,notes:'Late reply'},resolved.revision!)).rejects.toMatchObject({statusCode:409});
  await expect(resolveMoreInfo(db,resolved,getDemoUser(role),resolved.revision!)).rejects.toMatchObject({statusCode:409});
  const again=await requestMoreInfo(db,resolved,getDemoUser(role),'New question',resolved.revision!);expect(hasPendingMoreInfo(again)).toBe(true);
 }
});
it('does not move shipped, completed, denied or approved requests backward when old notes remain unresolved',async()=>{
 const {resolveMoreInfo}=await import('../server/utils/submittedRequests');
 for(const status of ['shipped','complete','denied','approved'] as const){
  const {db}=surplusDb();const request=await ensureSubmittedRequest(db,{id:9938,submissionId:'terminal-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status,moreInfoRequests:[{id:'old',notes:'Earlier question',requestedAt:'2026-10-01T00:00:00Z',requestedBy:3,resubmittedAt:'2026-10-02T00:00:00Z'}]});
  await expect(resolveMoreInfo(db,request,getDemoUser('internal'),request.revision??0)).rejects.toMatchObject({statusCode:409});
 }
});
it('supports an ongoing conversation from both sides, including after resubmission, until resolved',async()=>{
 const {replyToMoreInfo,resolveMoreInfo}=await import('../server/utils/submittedRequests');
 const {requestNotices}=await import('../server/utils/requestNotices');
 const {db}=surplusDb();let request=await ensureSubmittedRequest(db,{id:9939,submissionId:'ongoing-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 request=await requestMoreInfo(db,request,getDemoUser('internal'),'Initial question',0);const noteId=request.moreInfoRequests![0]!.id;
 for(const [role,notes] of [['agency','First answer'],['internal','Follow-up question'],['agency','Second answer'],['admin','Additional question'],['agency','Third answer']] as const){
  request=await replyToMoreInfo(db,request,getDemoUser(role),{noteId,notes},request.revision!);
  expect(request.status).toBe('needs_info');
 }
 expect(request.moreInfoRequests).toHaveLength(1);expect(request.moreInfoRequests![0]!.responses).toHaveLength(5);
 expect(request.moreInfoRequests![0]!.responses?.map(r=>r.respondedAs)).toEqual(['agency','reviewer','agency','reviewer','agency']);
 expect((await requestNotices(db,getDemoUser('agency'))).filter(n=>n.kind==='request-response').map(n=>n.notes)).toEqual(['Follow-up question','Additional question']);
 expect((await requestNotices(db,getDemoUser('internal'))).filter(n=>n.kind==='request-response').map(n=>n.notes)).toEqual(['First answer','Second answer','Third answer']);
 request=await updateSubmittedRequest(db,request,{status:'unopened',moreInfoRequests:request.moreInfoRequests!.map(n=>({...n,resubmittedAt:'2026-11-02T00:00:00Z'}))});
 const reviewed=await replyToMoreInfo(db,request,getDemoUser('internal'),{noteId,notes:'Clarification after resubmission'},request.revision!);expect(reviewed.status).toBe('unopened');
 const answered=await replyToMoreInfo(db,reviewed,getDemoUser('agency'),{noteId,notes:'Answer after resubmission'},reviewed.revision!);expect(answered.status).toBe('unopened');
 await expect(replyToMoreInfo(db,answered,{...getDemoUser('agency'),agencyId:11},{noteId,notes:'Unrelated'},answered.revision!)).rejects.toMatchObject({statusCode:404});
 const resolved=await resolveMoreInfo(db,answered,getDemoUser('admin'),answered.revision!);
 await expect(replyToMoreInfo(db,resolved,getDemoUser('internal'),{noteId,notes:'Closed'},resolved.revision!)).rejects.toMatchObject({statusCode:409});
});
it('permanently blocks editing or deleting messages after a recipient reads them',async()=>{
 const {markMoreInfoRead,editMoreInfoNote,submittedRequest}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();let request=await ensureSubmittedRequest(db,{id:9940,submissionId:'read-followup',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 request=await requestMoreInfo(db,request,getDemoUser('internal'),'Original message',0);const noteId=request.moreInfoRequests![0]!.id;
 const ownRead=await markMoreInfoRead(db,request,getDemoUser('internal'));expect(ownRead.moreInfoRequests![0]!.readAt).toBeUndefined();
 await expect(markMoreInfoRead(db,request,{...getDemoUser('agency'),agencyId:11})).rejects.toMatchObject({statusCode:404});
 const read=await markMoreInfoRead(db,request,getDemoUser('agency'));expect(read.moreInfoRequests![0]!.readAt).toBeTruthy();
 await expect(editMoreInfoNote(db,read,getDemoUser('admin'),{noteId,action:'edit',notes:'Revised message'},read.revision!)).rejects.toMatchObject({statusCode:409});
 await expect(editMoreInfoNote(db,read,getDemoUser('admin'),{noteId,action:'delete'},read.revision!)).rejects.toMatchObject({statusCode:409});
 const {canEditSubmission}=await import('../shared/requestEditing');expect(canEditSubmission(read)).toBe(false);
 await expect(editMoreInfoNote(db,request,getDemoUser('admin'),{noteId,action:'delete'},request.revision!)).rejects.toMatchObject({statusCode:409});
 expect((await submittedRequest(db,9940,getDemoUser('agency')))!.moreInfoRequests![0]!.deletedAt).toBeUndefined();
});
it('blocks editing and deleting messages with legacy notification read receipts',async()=>{
 const {editMoreInfoNote}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();const original=await ensureSubmittedRequest(db,{id:9943,submissionId:'legacy-read',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 const sent=await requestMoreInfo(db,original,getDemoUser('internal'),'Already read',0);const noteId=sent.moreInfoRequests![0]!.id;
 await db.prepare('INSERT INTO surplus_notice_reads(notice_id,user_id) VALUES(?,?)').bind(`followup:${noteId}`,getDemoUser('agency').id).run();
 await expect(editMoreInfoNote(db,sent,getDemoUser('admin'),{noteId,action:'edit',notes:'Corrected'},sent.revision!)).rejects.toMatchObject({statusCode:409});
 await expect(editMoreInfoNote(db,sent,getDemoUser('admin'),{noteId,action:'delete'},sent.revision!)).rejects.toMatchObject({statusCode:409});
});
it('records only the selected incoming notification as read and treats replies as reading prior messages',async()=>{
 const {markMoreInfoRead,replyToMoreInfo,editMoreInfoNote}=await import('../server/utils/submittedRequests');
 const {db}=surplusDb();let request=await ensureSubmittedRequest(db,{id:9944,submissionId:'selected-read',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 request=await requestMoreInfo(db,request,getDemoUser('internal'),'Initial',0);const noteId=request.moreInfoRequests![0]!.id;
 request=await replyToMoreInfo(db,request,getDemoUser('agency'),{noteId,notes:'Answer'},request.revision!);
 expect(request.moreInfoRequests![0]!.readAt).toBeTruthy();
 request=await replyToMoreInfo(db,request,getDemoUser('internal'),{noteId,notes:'Follow-up one'},request.revision!);
 expect(request.moreInfoRequests![0]!.responses![0]!.readAt).toBeTruthy();
 request=await replyToMoreInfo(db,request,getDemoUser('internal'),{noteId,notes:'Follow-up two'},request.revision!);
 const responses=request.moreInfoRequests![0]!.responses!;
 const read=await markMoreInfoRead(db,request,getDemoUser('agency'),`followup-response:${responses[1]!.id}`);
 expect(read.moreInfoRequests![0]!.responses![1]!.readAt).toBeTruthy();expect(read.moreInfoRequests![0]!.responses![2]!.readAt).toBeUndefined();
 await expect(editMoreInfoNote(db,read,getDemoUser('admin'),{noteId,action:'delete'},read.revision!)).rejects.toMatchObject({statusCode:409});
});

it('clears incoming message notification counts when opening the conversation without closing corrections',async()=>{
 const {markMoreInfoRead,replyToMoreInfo,reopenMoreInfoSubmission}=await import('../server/utils/submittedRequests');const {requestNotices}=await import('../server/utils/requestNotices');
 const {hasPendingMoreInfo,canEditSubmission}=await import('../shared/requestEditing');
 const {db}=surplusDb();let request=await ensureSubmittedRequest(db,{id:9945,submissionId:'read-notification',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened'});
 request=await requestMoreInfo(db,request,getDemoUser('internal'),'Update the duration in the request',0);
 request=await reopenMoreInfoSubmission(db,request,getDemoUser('internal'),request.revision!);const noteId=request.moreInfoRequests![0]!.id;
 expect((await requestNotices(db,getDemoUser('agency'))).filter(n=>!n.is_read)).toHaveLength(1);
 request=await markMoreInfoRead(db,request,getDemoUser('agency'));
 expect((await requestNotices(db,getDemoUser('agency'))).filter(n=>!n.is_read)).toHaveLength(0);expect(canEditSubmission(request)).toBe(true);
 request=await replyToMoreInfo(db,request,getDemoUser('agency'),{noteId,notes:'I will update the form.'},request.revision!);
 request=await markMoreInfoRead(db,request,getDemoUser('internal'));
 expect((await requestNotices(db,getDemoUser('internal'))).filter(n=>n.kind==='request-response'&&!n.is_read)).toHaveLength(0);
 expect(hasPendingMoreInfo(request)).toBe(true);expect(canEditSubmission(request)).toBe(true);
});
it('requires CDPH/WIC or Admin to explicitly reopen the form, independently of messages',async()=>{
 const {reopenMoreInfoSubmission,replyToMoreInfo,resolveMoreInfo,editSubmittedRequest}=await import('../server/utils/submittedRequests');
 const {canEditSubmission,hasPendingMoreInfo}=await import('../shared/requestEditing');const {requestNotices}=await import('../server/utils/requestNotices');
 const {db}=surplusDb();let request=await ensureSubmittedRequest(db,{id:9946,submissionId:'explicit-reopen',agencyId:10,agencyMemberId:100,participantName:'Synthetic',productName:'Fortini',status:'opened',approved:true});
 request=await requestMoreInfo(db,request,getDemoUser('internal'),'Please correct the duration.',0);
 expect(hasPendingMoreInfo(request)).toBe(true);expect(canEditSubmission(request)).toBe(false);
 await expect(editSubmittedRequest(db,getDemoUser('agency'),request,{durationMonths:3},request.revision!,{saveOnly:true})).rejects.toMatchObject({statusCode:409});
 await expect(reopenMoreInfoSubmission(db,request,getDemoUser('agency'),request.revision!)).rejects.toMatchObject({statusCode:403});
 const opened=await reopenMoreInfoSubmission(db,request,getDemoUser('internal'),request.revision!);
 expect(canEditSubmission(opened)).toBe(true);expect(opened.moreInfoRequests![0]!.resubmissionOpenedBy).toBe(getDemoUser('internal').id);expect(opened.approved).toBe(true);
 expect((await requestNotices(db,getDemoUser('agency'))).some(n=>n.title==='Request Reopened for Resubmission'&&!n.is_read)).toBe(true);
 const replied=await replyToMoreInfo(db,opened,getDemoUser('agency'),{noteId:opened.moreInfoRequests![0]!.id,notes:'I will update the form.'},opened.revision!);expect(canEditSubmission(replied)).toBe(true);
 const resolved=await resolveMoreInfo(db,replied,getDemoUser('admin'),replied.revision!);expect(canEditSubmission(resolved)).toBe(false);
 await expect(reopenMoreInfoSubmission(db,resolved,getDemoUser('internal'),resolved.revision!)).rejects.toMatchObject({statusCode:409});
});
