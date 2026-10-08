import { getMcKessonLogExportRows } from '../../utils/reportStore';
import { csvResponse } from '../../utils/reportExport';

export default defineEventHandler((event) =>
    csvResponse(event, getMcKessonLogExportRows(), 'cdphwic-mckesson-log.csv'),
);
