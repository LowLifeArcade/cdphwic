import { createError, defineEventHandler, getQuery } from 'h3';
import { listSurplusDispositions } from '../../utils/surplusDisposalReport';
import { surplusContext } from '../../utils/surplusContext';

function dateQuery(value: unknown, name: string): string | undefined {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `Enter a valid ${name} date.` });
    return value;
}

export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const query = getQuery(event);
    const from = dateQuery(query.from, 'start');
    const to = dateQuery(query.to, 'end');
    return listSurplusDispositions(db, user, from, to);
});
