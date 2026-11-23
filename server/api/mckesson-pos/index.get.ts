import {mckessonPoContext} from '../../utils/mckessonPoContext';
import {listPurchaseOrders} from '../../utils/mckessonPo';
export default defineEventHandler(async event=>{const {db}=mckessonPoContext(event);return {pos:await listPurchaseOrders(db)};});
