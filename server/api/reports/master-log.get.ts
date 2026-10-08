import { getMasterLogRows, MASTER_LOG_MONTHS } from '../../utils/reportStore';

export default defineEventHandler(() => ({ months: MASTER_LOG_MONTHS, rows: getMasterLogRows() }));
