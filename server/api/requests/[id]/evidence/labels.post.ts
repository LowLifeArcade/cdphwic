import {readBody,createError} from 'h3';
import {shipmentEvidenceContext} from '../../../../utils/shipmentEvidence';
import {persistShipmentEvidence} from '../../../../utils/submittedRequests';
import {validDate,localDate} from '../../../../../shared/surplus';
export default defineEventHandler(async event=>{
 const {db,user,request}=await shipmentEvidenceContext(event);if(user.role!=='admin'&&user.memberType!=='agency')throw createError({statusCode:403});
 const body=await readBody<{index:number;expectedIssue:string;date:string;reference:string}>(event);
 if(!Number.isSafeInteger(body.index)||body.index<0||!validDate(body.date)||body.date>localDate()||typeof body.reference!=='string'||!body.reference.trim()||body.reference.length>1000)throw createError({statusCode:400,statusMessage:'Enter the date labels were sent and a reference (1,000 characters or fewer).'});
 return {request:await persistShipmentEvidence(db,request,body.index,body.expectedIssue,{labelsSent:{date:body.date,reference:body.reference.trim(),recordedAt:new Date().toISOString(),recordedBy:user.id}})};
});
