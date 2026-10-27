import { defineEventHandler, readBody } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { createForecast, confirmForecast } from '../../utils/surplusReports';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const b = await readBody(event);
    return b.forecastId ? confirmForecast(db, user, b) : createForecast(db, user, b);
});
