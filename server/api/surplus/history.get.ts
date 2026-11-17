import { defineEventHandler, getQuery, createError } from 'h3';
import { surplusContext } from '../../utils/surplusContext';
import { canSeeAgency,isReviewer } from '../../../shared/surplus';
import { decorateSurplusMovements } from '../../../shared/surplusMovement';
import { SEED_USERS } from '../../data/seed';
export default defineEventHandler(async (event) => {
    const { db, user } = surplusContext(event);
    const id = String(getQuery(event).lotId ?? '');
    const lot = await db.prepare('SELECT agency_id FROM surplus_lots WHERE id=?').bind(id).first<any>();
    if (!lot || !canSeeAgency(user, lot.agency_id)) throw createError({ statusCode: 404 });
    const rows=(
        await db
            .prepare('SELECT * FROM surplus_movements WHERE lot_id=? ORDER BY created_at DESC,rowid DESC')
            .bind(id)
            .all()
    ).results;
    const commands=(await db.prepare('SELECT id,payload FROM surplus_commands WHERE id IN (SELECT operation_id FROM surplus_movements WHERE lot_id=?)').bind(id).all<{id:string;payload:string}>()).results;
    const payloadById=new Map(commands.map(command=>[command.id,command.payload]));
    const enriched=rows.map((row:any)=>{
        const actor=SEED_USERS.find(user=>user.id===row.actor_id);
        return {...row,actor_name:actor?.name??'',agency_authored:actor?.memberType==='agency'&&actor.agencyId===lot.agency_id,command_payload:payloadById.get(row.operation_id)??'{}'};
    });
    return decorateSurplusMovements(enriched,!isReviewer(user)&&user.memberType==='agency'&&user.agencyId===lot.agency_id);
});
