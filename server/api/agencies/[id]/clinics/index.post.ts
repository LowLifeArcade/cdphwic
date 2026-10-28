import * as XLSX from 'xlsx';
import { clinicContext } from '../../../../utils/clinicContext';
import { saveClinic, importClinics } from '../../../../utils/clinicStore';
import type { ClinicAddress } from '../../../../../shared/shipping';
export default defineEventHandler(async (event) => {
    const { db, user, agencyId } = clinicContext(event, true);
    if (getHeader(event, 'content-type')?.includes('multipart/form-data')) {
        const file = (await readMultipartFormData(event))?.find((p) => p.name === 'file');
        if (
            !file?.filename ||
            !file.data.length ||
            file.data.length > 2_000_000 ||
            !/\.(csv|xlsx|xls)$/i.test(file.filename)
        )
            throw createError({ statusCode: 400, statusMessage: 'Choose a CSV or Excel file smaller than 2 MB.' });
        let rows: Partial<ClinicAddress>[];
        try {
            const workbook = XLSX.read(file.data, { type: 'buffer', raw: true, sheetRows: 502 });
            const sheet = workbook.Sheets[workbook.SheetNames[0]!];
            if (!sheet) throw new Error();
            rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        } catch {
            throw createError({
                statusCode: 400,
                statusMessage: 'The clinic file could not be read. Use the provided template.',
            });
        }
        return { count: await importClinics(db, user, agencyId, rows) };
    }
    return { clinic: await saveClinic(db, user, agencyId, await readBody(event)) };
});
