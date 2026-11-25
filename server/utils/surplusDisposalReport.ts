import { createError } from 'h3';
import type { SessionUser } from '../../shared/domain';
import type { SurplusDisposalRow } from '../../shared/surplusDisposalReport';
import { isReviewer, validDate } from '../../shared/surplus';
import { SEED_AGENCIES, SEED_USERS } from '../data/seed';

export async function listSurplusDispositions(
    db: D1Database,
    user: SessionUser,
    from?: string,
    to?: string,
): Promise<SurplusDisposalRow[]> {
    const start = from || undefined;
    const end = to || undefined;
    if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) {
        throw createError({ statusCode: 400, statusMessage: 'Enter a valid disposal date range.' });
    }

    const conditions = ["m.kind='deduct'", "json_extract(m.reason,'$.reason') IN ('Donation','Destruction')"];
    const params: (string | number)[] = [];
    if (!isReviewer(user)) {
        if (user.memberType !== 'agency' || !Number.isSafeInteger(user.agencyId)) {
            throw createError({ statusCode: 403, statusMessage: 'You cannot view surplus disposal records.' });
        }
        conditions.push('l.agency_id=?');
        params.push(user.agencyId!);
    }
    if (start) {
        conditions.push("json_extract(m.reason,'$.date')>=?");
        params.push(start);
    }
    if (end) {
        conditions.push("json_extract(m.reason,'$.date')<=?");
        params.push(end);
    }

    const rows = (await db.prepare(`
        SELECT m.id,
            json_extract(m.reason,'$.reason') AS kind,
            json_extract(m.reason,'$.date') AS event_date,
            COALESCE((SELECT correction.corrected_quantity FROM surplus_movements correction
                WHERE correction.corrects_movement_id=m.id ORDER BY correction.rowid DESC LIMIT 1),m.quantity) AS quantity,
            m.quantity AS original_quantity,
            EXISTS(SELECT 1 FROM surplus_movements correction WHERE correction.corrects_movement_id=m.id) AS corrected,
            l.formula_name,l.form,l.flavor,l.packaging,l.expiration_date,l.clinic_name,l.agency_id,
            json_extract(m.reason,'$.staff') AS staff_name,m.actor_id,m.created_at AS recorded_at
        FROM surplus_movements m
        JOIN surplus_lots l ON l.id=m.lot_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY json_extract(m.reason,'$.date') DESC,m.created_at DESC,m.rowid DESC
    `).bind(...params).all<any>()).results;

    return rows.map((row: any) => ({
        id: row.id,
        kind: row.kind as SurplusDisposalRow['kind'],
        event_date: row.event_date ?? '',
        quantity: Number(row.quantity),
        original_quantity: Number(row.original_quantity),
        corrected: Boolean(row.corrected),
        formula_name: row.formula_name,
        form: row.form,
        flavor: row.flavor ?? '',
        packaging: row.packaging ?? '',
        expiration_date: row.expiration_date,
        clinic_name: row.clinic_name ?? '',
        agency_id: row.agency_id,
        agency_name: SEED_AGENCIES.find((agency) => agency.id === row.agency_id)?.name ?? `Agency ${row.agency_id}`,
        staff_name: row.staff_name ?? '',
        recorded_by: SEED_USERS.find((actor) => actor.id === row.actor_id)?.name ?? 'Unknown user',
        recorded_at: row.recorded_at,
    }));
}
