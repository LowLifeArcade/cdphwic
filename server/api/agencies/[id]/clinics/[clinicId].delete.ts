import { clinicContext } from '../../../../utils/clinicContext';
import { archiveClinic } from '../../../../utils/clinicStore';
export default defineEventHandler(async (event) => {
    const { db, user, agencyId } = clinicContext(event, true);
    await archiveClinic(db, user, agencyId, getRouterParam(event, 'clinicId')!);
    return { archived: true };
});
