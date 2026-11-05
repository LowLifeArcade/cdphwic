import {expect,it} from 'vitest';
import {restoreSubmittedForm} from '../shared/requestEditing';
import type {RequestRecord} from '../shared/domain';

it('restores actual storage clinics independently of the request shipping clinic',()=>{
 const request={id:1,participantName:'Example Participant',productName:'Example',shipping:{clinicId:'destination'},surplusItems:[
  {productName:'Example',units:3,clinicId:'storage-other',expirationDate:'2027-01-01'},
  {productName:'Example',units:2},
 ]} as RequestRecord;
 const restored=restoreSubmittedForm(request);
 expect(restored.surplusEntries.map(entry=>entry.clinicId)).toEqual(['storage-other',undefined]);
 expect(restored.surplusEntries[0]).toMatchObject({units:3,expirationDate:'2027-01-01'});
 expect(restored.shipping?.clinicId).toBe('destination');
});
