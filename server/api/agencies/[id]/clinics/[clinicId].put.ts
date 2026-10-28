import { clinicContext } from '../../../../utils/clinicContext';
import { saveClinic } from '../../../../utils/clinicStore';
export default defineEventHandler(async (event) => {
    const { db, user, agencyId } = clinicContext(event, true);
    return { clinic: await saveClinic(db, user, agencyId, await readBody(event), getRouterParam(event, 'clinicId')) };
});
