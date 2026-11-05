import {surplusContext} from '../../../../utils/surplusContext';
import {assignSurplusClinic} from '../../../../utils/surplusClinicLocations';
export default defineEventHandler(async event=>{
 const {db,user}=surplusContext(event);
 const body=await readBody(event);
 return {lot:await assignSurplusClinic(db,user,getRouterParam(event,'id')??'',body?.clinicId,body?.expectedVersion)};
});
