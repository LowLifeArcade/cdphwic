import {readMultipartFormData,createError} from 'h3';
import {shipmentEvidenceContext} from '../../../../utils/shipmentEvidence';
import {persistShipmentEvidence} from '../../../../utils/submittedRequests';
import {validateDamageImage} from '../../../../../shared/shipmentEvidence';
export default defineEventHandler(async event=>{
 const {db,user,env,request}=await shipmentEvidenceContext(event);
 if(user.role!=='admin'&&user.memberType!=='agency')throw createError({statusCode:403});
 const parts=await readMultipartFormData(event);const file=parts?.find(p=>p.name==='file');const index=Number(parts?.find(p=>p.name==='index')?.data.toString());const expectedIssue=parts?.find(p=>p.name==='expectedIssue')?.data.toString();
 const row=request.shipments?.[index];
 if(!Number.isSafeInteger(index)||index<0||!row?.issue||JSON.stringify(row.issue)!==expectedIssue)throw createError({statusCode:409,statusMessage:'Issue changed. Refresh before uploading.'});
 if(!file?.data||!file.filename)throw createError({statusCode:400,statusMessage:'Choose an image.'});
 if((row.issue.images?.length??0)>=10)throw createError({statusCode:400,statusMessage:'Up to 10 damage images may be attached to each issue.'});
 const contentType=validateDamageImage(file.data,file.type??'');const imageId=crypto.randomUUID();const storageKey=`${env.ENV}/shipment-evidence/${request.id}/${imageId}`;
 const image={id:imageId,fileName:file.filename.slice(0,200),contentType,storageKey,uploadedAt:new Date().toISOString(),uploadedBy:user.id};
 await env.PRESCRIPTIONS.put(storageKey,file.data,{httpMetadata:{contentType}});
 try{return {request:await persistShipmentEvidence(db,request,index,expectedIssue!,{images:[...(row.issue.images??[]),image]})};}catch(e){await env.PRESCRIPTIONS.delete(storageKey);throw e;}
});
