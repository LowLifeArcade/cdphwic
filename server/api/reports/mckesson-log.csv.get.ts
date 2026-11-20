import { reportFeatureFlags } from '../../../shared/featureFlags';
import { getMcKessonLogExportRows } from '../../utils/reportStore';
import { csvResponse } from '../../utils/reportExport';

export default defineEventHandler((event) => {
    if (!reportFeatureFlags(useRuntimeConfig(event).public).mckessonReport) throw createError({ statusCode: 404, statusMessage: 'Report not available.' });
    return csvResponse(event, getMcKessonLogExportRows(), 'cdphwic-mckesson-log.csv');
});
