import {defineEventHandler,getRouterParam} from 'h3';
import {surplusContext} from '../../../../utils/surplusContext';
import {listTransferLabels} from '../../../../utils/transferShippingLabels';
import {linkedTransfer} from '../../../../utils/requestTransferInventory';
export default defineEventHandler(async event=>{const {db,user}=surplusContext(event);const id=getRouterParam(event,'id')??'';const labels=await listTransferLabels(db,user,id);const transfer=await linkedTransfer(db,id);return {labels,requestedLabelCount:transfer?.requested_label_count??0};});
