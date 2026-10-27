import { defineEventHandler, getQuery, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { canSeeAgency } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const id = String(getQuery(event).lotId ?? '');
    const lot = await db.prepare('SELECT agency_id FROM surplus_lots WHERE id=?').bind(id).first<any>();
    if (!lot || !canSeeAgency(user, lot.agency_id)) throw createError({ statusCode: 404 });
    return (
        await db
            .prepare('SELECT * FROM surplus_movements WHERE lot_id=? ORDER BY created_at DESC,rowid DESC')
            .bind(id)
            .all()
    ).results;
});
