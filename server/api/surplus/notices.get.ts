import { defineEventHandler } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { listSurplusNotices } from '../../utils/surplusNotices';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    return {
        notices: await listSurplusNotices(db, user),
        forms: (
            await db
                .prepare('SELECT id,kind,file_name,created_at FROM surplus_forms ORDER BY created_at DESC,rowid DESC')
                .all()
        ).results,
    };
});
