import {mckessonPoContext} from '../../../utils/mckessonPoContext';
import {placePoOrder} from '../../../utils/mckessonPo';
import type {PoOrderInput} from '../../../../shared/mckessonPo';
export default defineEventHandler(async event=>{const {db,user}=mckessonPoContext(event);return {order:await placePoOrder(db,await readBody<PoOrderInput>(event),user.id)};});
