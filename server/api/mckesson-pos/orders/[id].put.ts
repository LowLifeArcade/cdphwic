import {mckessonPoContext} from '../../../utils/mckessonPoContext';
import {updatePoOrder} from '../../../utils/mckessonPo';
export default defineEventHandler(async event=>{const {db,user}=mckessonPoContext(event);return {order:await updatePoOrder(db,getRouterParam(event,'id')??'',await readBody(event),user.id)};});
