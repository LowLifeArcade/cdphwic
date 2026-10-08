import { getMasterLogExportRows } from '../../utils/reportStore';
import { csvResponse } from '../../utils/reportExport';

export default defineEventHandler((event) => csvResponse(event, getMasterLogExportRows(), 'cdphwic-master-log.csv'));
