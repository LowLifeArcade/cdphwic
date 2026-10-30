import {surplusContext} from '../../../utils/surplusContext';
import {shipRequestTransfer} from '../../../utils/requestTransfers';
import {updateRequestRecord} from '../../../utils/requestStore';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);
 const result=await shipRequestTransfer(db,getRouterParam(event,'id')??'',user);
 updateRequestRecord(result.request.id,result.request);
 // Sender receives transfer logistics only, never the participant request.
 return {transfer:result.transfer};
});
