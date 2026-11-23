import {mckessonPoContext} from '../../utils/mckessonPoContext';
import {activatePurchaseOrder} from '../../utils/mckessonPo';
import type {PoInput} from '../../../shared/mckessonPo';
export default defineEventHandler(async event=>{const {db,user}=mckessonPoContext(event);return {po:await activatePurchaseOrder(db,await readBody<PoInput>(event),user.id)};});
