import {defineEventHandler,getRouterParam,setResponseHeader} from 'h3';
import {surplusContext} from '../../../../utils/surplusContext';
import {readTransferLabel} from '../../../../utils/transferShippingLabels';
export default defineEventHandler(async event=>{
 const {db,user,env}=surplusContext(event);const {label,body}=await readTransferLabel(db,env.PRESCRIPTIONS,user,getRouterParam(event,'id')??'',getRouterParam(event,'labelId')??'');
 setResponseHeader(event,'content-type',label.contentType);setResponseHeader(event,'cache-control','private, no-store');setResponseHeader(event,'x-content-type-options','nosniff');setResponseHeader(event,'content-disposition',`inline; filename="${label.fileName.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);return body;
});
