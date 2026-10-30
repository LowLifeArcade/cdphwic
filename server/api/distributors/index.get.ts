import {surplusContext} from '../../utils/surplusContext';
import {listDistributors} from '../../utils/distributors';
export default defineEventHandler(async event=>{const {db}=surplusContext(event);return {distributors:await listDistributors(db)};});
