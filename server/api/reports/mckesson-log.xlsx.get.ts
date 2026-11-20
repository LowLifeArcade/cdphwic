import { reportFeatureFlags } from '../../../shared/featureFlags';
import { getMcKessonLogExportRows } from '../../utils/reportStore';
import { xlsxResponse } from '../../utils/reportExport';

export default defineEventHandler((event) => {
    if (!reportFeatureFlags(useRuntimeConfig(event).public).mckessonReport) throw createError({ statusCode: 404, statusMessage: 'Report not available.' });
    return xlsxResponse(event, getMcKessonLogExportRows(), 'McKesson Log', 'cdphwic-mckesson-log.xlsx');
});
