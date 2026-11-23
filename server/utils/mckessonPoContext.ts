import {createError,type H3Event} from 'h3';
import {surplusContext} from './surplusContext';
import {isReviewer} from '../../shared/surplus';
export function mckessonPoContext(event:H3Event) {
 const context=surplusContext(event);
 if(!isReviewer(context.user))throw createError({statusCode:403,statusMessage:'Only CDPH/WIC or Admin can manage McKesson POs and orders.'});
 return context;
}
