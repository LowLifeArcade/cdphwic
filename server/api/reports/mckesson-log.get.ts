import { reportFeatureFlags } from '../../../shared/featureFlags';
import { getMcKessonLogRows } from '../../utils/reportStore';

export default defineEventHandler((event) => {
    if (!reportFeatureFlags(useRuntimeConfig(event).public).mckessonReport) throw createError({ statusCode: 404, statusMessage: 'Report not available.' });
    return { rows: getMcKessonLogRows() };
});
