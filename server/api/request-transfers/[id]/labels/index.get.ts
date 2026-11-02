import {defineEventHandler,getRouterParam} from 'h3';
import {surplusContext} from '../../../../utils/surplusContext';
import {listTransferLabels} from '../../../../utils/transferShippingLabels';
export default defineEventHandler(async event=>{const {db,user}=surplusContext(event);return {labels:await listTransferLabels(db,user,getRouterParam(event,'id')??'')};});
