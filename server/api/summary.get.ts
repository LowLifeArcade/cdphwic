import { buildSummary } from '../utils/summary';

export default defineEventHandler(() => ({
    summary: buildSummary(),
    filters: { categories: ['standard', 'exempt', 'nutritional'], dateRanges: ['YTD', 'Last 30 days', 'Last 90 days'] },
}));
