import {surplusContext} from '../../utils/surplusContext';
import {saveDistributor} from '../../utils/distributors';
import {isReviewer} from '../../../shared/surplus';
import type {DistributorProfile} from '../../../shared/distributors';
export default defineEventHandler(async event=>{const {db,user}=surplusContext(event);if(!isReviewer(user))throw createError({statusCode:403});return {distributor:await saveDistributor(db,await readBody<Partial<DistributorProfile>>(event),user.id)};});
