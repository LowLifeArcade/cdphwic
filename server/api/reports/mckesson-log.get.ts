import { getMcKessonLogRows } from '../../utils/reportStore';

export default defineEventHandler(() => ({ rows: getMcKessonLogRows() }));
