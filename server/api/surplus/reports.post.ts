import { defineEventHandler, readBody, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { isReviewer } from '../../../shared/surplus';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    if (!isReviewer(user)) throw createError({ statusCode: 403 });
    const b = await readBody(event);
    if (!['rejected', 'already-accounted'].includes(b.status) || !b.reason?.trim())
        throw createError({ statusCode: 400, statusMessage: 'Provide a reason for this report decision.' });
    try {
        await db.batch([
            db
                .prepare(
                    "INSERT INTO surplus_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM surplus_reports WHERE id=? AND status='pending') THEN 1 ELSE 0 END",
                )
                .bind(b.reportId),
            ...(b.status === 'rejected'
                ? [
                      db
                          .prepare(
                              "DELETE FROM surplus_notice_reads WHERE notice_id='forecast:'||(SELECT forecast_id FROM surplus_reports WHERE id=?)",
                          )
                          .bind(b.reportId),
                  ]
                : []),
            db
                .prepare(
                    "UPDATE surplus_forecasts SET status=?,actual_units=CASE WHEN ?='rejected' THEN NULL ELSE actual_units END,report_id=CASE WHEN ?='rejected' THEN NULL ELSE report_id END WHERE report_id=?",
                )
                .bind(b.status === 'rejected' ? 'awaiting-count' : 'reconciled', b.status, b.status, b.reportId),
            db
                .prepare(
                    "UPDATE surplus_reports SET status=?,reason=reason||?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",
                )
                .bind(b.status, ` | Review: ${b.reason}`, user.id, b.reportId),
            db.prepare('DELETE FROM surplus_guard'),
        ]);
    } catch {
        throw createError({ statusCode: 409, statusMessage: 'This report has already been reviewed.' });
    }
    return { ok: true };
});
