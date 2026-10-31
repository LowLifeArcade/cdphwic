import {defineEventHandler} from 'h3';
import {surplusContext} from '../../../utils/surplusContext';
import {pendingTransferCount} from '../../../utils/pendingTransfers';
export default defineEventHandler(async(event)=>{
 const {db,user}=surplusContext(event);
 return {count:await pendingTransferCount(db,user)};
});
