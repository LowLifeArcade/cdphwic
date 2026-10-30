import {surplusContext} from '../../../utils/surplusContext';
import {saveRequestTransferEta} from '../../../utils/requestTransfers';
import {updateRequestRecord} from '../../../utils/requestStore';
import type {RequestShipment} from '../../../../shared/requestShipments';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);const body=await readBody<Pick<RequestShipment,'eta'|'carrier'|'trackingNumbers'>&{revision:number}>(event);
 const request=await saveRequestTransferEta(db,getRouterParam(event,'id')??'',user,body,body?.revision);updateRequestRecord(request.id,request);return {request};
});
