import {defineEventHandler,getRouterParam,readMultipartFormData,createError} from 'h3';
import {surplusContext} from '../../../../utils/surplusContext';
import {storeTransferLabel} from '../../../../utils/transferShippingLabels';
export default defineEventHandler(async event=>{
 const {db,user,env}=surplusContext(event);const parts=await readMultipartFormData(event);const file=parts?.find(p=>p.name==='file');
 if(!file?.data||!file.filename)throw createError({statusCode:400,statusMessage:'Choose a shipping label.'});
 return {label:await storeTransferLabel(db,env.PRESCRIPTIONS,env.ENV,user,getRouterParam(event,'id')??'',{filename:file.filename,type:file.type??'',data:file.data})};
});
