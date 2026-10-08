import { getMasterLogExportRows } from '../../utils/reportStore';
import { xlsxResponse } from '../../utils/reportExport';

export default defineEventHandler((event) =>
    xlsxResponse(event, getMasterLogExportRows(), 'Master Log', 'cdphwic-master-log.xlsx'),
);
