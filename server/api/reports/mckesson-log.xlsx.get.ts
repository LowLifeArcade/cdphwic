import { getMcKessonLogExportRows } from '../../utils/reportStore';
import { xlsxResponse } from '../../utils/reportExport';

export default defineEventHandler((event) =>
    xlsxResponse(event, getMcKessonLogExportRows(), 'McKesson Log', 'cdphwic-mckesson-log.xlsx'),
);
