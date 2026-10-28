import { clinicContext } from '../../../../utils/clinicContext';
import { listClinics } from '../../../../utils/clinicStore';
export default defineEventHandler(async (event) => {
    const { db, user, agencyId } = clinicContext(event);
    return { clinics: await listClinics(db, user, agencyId) };
});
