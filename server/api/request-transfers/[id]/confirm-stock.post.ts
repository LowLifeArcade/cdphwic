import {surplusContext} from '../../../utils/surplusContext';
import {confirmRequestTransferStock} from '../../../utils/requestTransfers';
import {updateRequestRecord} from '../../../utils/requestStore';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);
 const body=await readBody<{requestedLabelCount?:number}>(event);
 const result=await confirmRequestTransferStock(db,getRouterParam(event,'id')??'',user,body?.requestedLabelCount as number);
 updateRequestRecord(result.request.id,result.request);
 return {transfer:result.transfer};
});
