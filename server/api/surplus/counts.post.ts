import {defineEventHandler,readBody} from 'h3';
import {surplusContext} from '../../utils/surplusContext';
import {submitAgencySurplusCount} from '../../utils/surplusReports';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);
 return submitAgencySurplusCount(db,user,await readBody(event));
});
