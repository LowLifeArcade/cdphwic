import {getRouterParam,setResponseHeader,createError} from 'h3';
import {shipmentEvidenceContext} from '../../../../utils/shipmentEvidence';
import {findDamageImage} from '../../../../../shared/shipmentEvidence';
export default defineEventHandler(async event=>{
 const {env,request}=await shipmentEvidenceContext(event);const image=findDamageImage(request,getRouterParam(event,'imageId')??'');
 if(!image)throw createError({statusCode:404});const object=await env.PRESCRIPTIONS.get(image.storageKey);if(!object?.body)throw createError({statusCode:404});
 setResponseHeader(event,'content-type',image.contentType);setResponseHeader(event,'cache-control','private, no-store');setResponseHeader(event,'x-content-type-options','nosniff');setResponseHeader(event,'content-disposition',`inline; filename="${image.fileName.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);return object.body;
});
