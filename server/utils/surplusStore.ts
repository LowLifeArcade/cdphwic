import type { SurplusReport, SurplusForecast, SurplusTransfer, SurplusMovement } from '../../shared/surplus';
import {resolveSurplusClinic,decodeSurplusLot,surplusLotColumns} from './surplusClinicLocations';
import { SEED_AGENCIES,SEED_USERS } from '../data/seed';
import type { SessionUser } from '../../shared/domain';
import {
    canSeeAgency,
    isReviewer,
    localDate,
    daysRemaining,
    validDate,
    lotKey,
    type SurplusCommand,
    type SurplusLot,
    type SurplusVariant,
} from '../../shared/surplus';
const columns = surplusLotColumns;
function fail(message: string) {
    throw Object.assign(new Error(message), { statusCode: 409 });
}
export async function ensureSurplusLot(db: D1Database, agencyId: number, v: SurplusVariant): Promise<SurplusLot> {
    if (
        !SEED_AGENCIES.some((a) => a.id === agencyId) ||
        !['powder', 'concentrate', 'ready-to-feed'].includes(v.form) ||
        !Number.isSafeInteger(agencyId) ||
        !v.formulaName?.trim() ||
        !v.form?.trim() ||
        !validDate(v.expirationDate)
    )
        fail('Agency, formula, form and valid expiration date are required.');
    const clinic=await resolveSurplusClinic(db,agencyId,v.clinicId);
    await db
        .prepare(
            'INSERT OR IGNORE INTO surplus_lots(id,agency_id,variant_key,formula_name,form,flavor,packaging,expiration_date,clinic_id,clinic_name,clinic_address) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
            crypto.randomUUID(),
            agencyId,
            lotKey(v),
            v.formulaName.trim().replace(/\s+/g, ' '),
            v.form,
            v.flavor.trim().replace(/\s+/g, ' '),
            v.packaging?.trim().replace(/\s+/g, ' ')??'',
            v.expirationDate,
            clinic.clinicId??null,clinic.clinicName??null,clinic.clinicAddress?JSON.stringify(clinic.clinicAddress):null,
        )
        .run();
    return decodeSurplusLot((await db
        .prepare(`SELECT ${columns} FROM surplus_lots WHERE agency_id=? AND variant_key=?`)
        .bind(agencyId, lotKey(v))
        .first<SurplusLot>())!);
}
export async function executeSurplusCommand(
    db: D1Database,
    user: SessionUser,
    c: SurplusCommand,
    today = localDate(),
): Promise<{ operationId: string; lotId: string; transferId?: string }> {
    if (!c.operationId || !c.lotId) fail('An operation ID and lot are required.');
    const payload = JSON.stringify(c);
    const prior = await db.prepare('SELECT * FROM surplus_commands WHERE id=?').bind(c.operationId).first<any>();
    if (prior) {
        if (prior.payload !== payload || prior.actor_id !== user.id) fail('Operation ID already used.');
        return JSON.parse(prior.result);
    }
    const initial=await db.prepare(`SELECT ${columns} FROM surplus_lots WHERE id=?`).bind(c.lotId).first<SurplusLot>();
    if(!initial)fail('Inventory lot not found.');
    const initialLot=decodeSurplusLot(initial);
    if(c.kind==='correct-entry'&&(isReviewer(user)||user.memberType!=='agency'||user.agencyId!==initialLot.agencyId))
        throw Object.assign(new Error('Only the Local Agency can correct entries for its own inventory.'),{statusCode:403});
    const agencyAdjustment = c.kind === 'deduct' && ['Donation', 'Destruction'].includes(c.reason ?? '');
    let correctionTarget:any;
    if(c.kind==='correct-entry'){
        if(!c.correctionOf)fail('Select the inventory history entry to correct.');
        correctionTarget=await db.prepare('SELECT m.*,c.payload AS command_payload FROM surplus_movements m JOIN surplus_commands c ON c.id=m.operation_id WHERE m.id=? AND m.lot_id=?').bind(c.correctionOf,c.lotId).first<any>();
        if(!correctionTarget||correctionTarget.corrects_movement_id)fail('Only an original eligible inventory entry can be corrected.');
        let originalCommand:any={};
        let originalReason:any={};
        try{originalCommand=JSON.parse(correctionTarget.command_payload??'{}');}catch{}
        try{originalReason=JSON.parse(correctionTarget.reason??'{}');}catch{}
        const agencyCount=correctionTarget.kind==='reconcile'&&originalCommand.kind==='reconcile'&&!originalCommand.reportId;
        const agencyAdjustment=correctionTarget.kind==='deduct'&&originalCommand.kind==='deduct'&&['Donation','Destruction'].includes(originalReason.reason??'');
        const originalActor=SEED_USERS.find(actor=>actor.id===correctionTarget.actor_id);
        const ownAgencyAdjustment=agencyAdjustment&&originalActor?.memberType==='agency'&&originalActor.agencyId===initialLot.agencyId;
        if(!agencyCount&&!ownAgencyAdjustment)
            fail('This inventory entry is not eligible for agency correction.');
    }
    if(!isReviewer(user)){
        const ownsLot = user.memberType === 'agency' && user.agencyId === initialLot.agencyId;
        const allowedAction = (c.kind === 'reconcile' && !c.reportId) || agencyAdjustment || c.kind==='correct-entry';
        if (!ownsLot || !allowedAction)
            throw Object.assign(new Error('Local Agencies may only count, adjust, or correct entries for their own inventory.'),{statusCode:403});
        if(c.kind === 'reconcile' && (!c.confirmerName?.trim()||!validDate(c.date??'')||c.date!>today))
            throw Object.assign(new Error('Enter the count date and staff name attesting to the count.'),{statusCode:400});
        if(c.kind === 'reconcile' && (c.clinicId??'')!==(initialLot.clinicId??''))
            throw Object.assign(new Error('A Local Agency can only count inventory at the selected clinic.'),{statusCode:403});
        if (agencyAdjustment && (!c.confirmerName?.trim() || !validDate(c.date ?? '') || c.date! > today))
            throw Object.assign(new Error('Enter the adjustment date and staff name attesting to the inventory change.'),{statusCode:400});
        if(c.kind==='correct-entry'&&(!c.reason?.trim()||!c.confirmerName?.trim()||!validDate(c.date??'')||c.date!>today||!Number.isInteger(c.expectedVersion)))
            throw Object.assign(new Error('Enter the corrected quantity, explanation, correcting staff name and correction date.'),{statusCode:400});
    }
    if (c.kind !== 'expire') await expireSurplusLots(db, today);
    const stored = await db.prepare(`SELECT ${columns} FROM surplus_lots WHERE id=?`).bind(c.lotId).first<SurplusLot>();
    if (!stored) fail('Inventory lot not found.');
    const lot=decodeSurplusLot(stored!);
    const pending = "EXISTS(SELECT 1 FROM surplus_commands WHERE id=? AND status='pending')";
    const steps: D1PreparedStatement[] = [
        db
            .prepare('INSERT OR IGNORE INTO surplus_commands(id,actor_id,payload) VALUES(?,?,?)')
            .bind(c.operationId, user.id, payload),
    ];
    const guard = (condition: string, args: unknown[] = []) =>
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_guard(ok) SELECT CASE WHEN (${condition}) THEN 1 ELSE 0 END WHERE ${pending}`,
                )
                .bind(...args, c.operationId),
        );
    const update = (set: string, args: unknown[] = [], id = c.lotId) =>
        steps.push(
            db
                .prepare(`UPDATE surplus_lots SET ${set},version=version+1 WHERE id=? AND ${pending}`)
                .bind(...args, id, c.operationId),
        );
    guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=?)', [lot!.id, lot!.version]);
    let transferId = c.transferId;
    let movementLot = c.lotId;
    let correctionOf:string|undefined;
    let correctedQuantity:number|null=null;
    let quantity = c.quantity ?? 0;
    if (
        ['reconcile', 'deduct', 'reserve', 'correct-entry'].includes(c.kind) &&
        (!Number.isSafeInteger(quantity) || quantity < 0 || (!['reconcile','correct-entry'].includes(c.kind) && quantity === 0))
    )
        fail('Enter a valid whole number of units.');
    if (c.kind === 'reconcile') {
        if (!c.reason?.trim() || !Number.isInteger(c.expectedVersion))
            fail('A reason and current inventory version are required.');
        guard(
            'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND reserved<=? AND (expired_units=0 OR expiration_date<?))',
            [lot!.id, c.expectedVersion, quantity, today],
        );
        update(
            'on_hand=CASE WHEN expiration_date<? THEN 0 ELSE ? END,expired_units=CASE WHEN expiration_date<? THEN ? ELSE 0 END',
            [today, quantity, today, quantity],
        );
        if (c.reportId) {
            const correctingClinic=c.clinicId!==undefined;
            if(correctingClinic && c.clinicId!==(lot.clinicId??''))fail('Select the same storage clinic as the inventory lot.');
            guard(
                "EXISTS(SELECT 1 FROM surplus_reports WHERE id=? AND status='pending' AND agency_id=? AND reported_units=? AND lower(formula_name)=lower(?) AND form=? AND lower(flavor)=lower(?) AND lower(packaging)=lower(?) AND (expiration_date=? OR expiration_date='') AND (COALESCE(clinic_id,'')=? OR ?=1))",
                [c.reportId, lot!.agencyId, quantity, lot!.formulaName, lot!.form, lot!.flavor,lot!.packaging??'', lot!.expirationDate,lot.clinicId??'',correctingClinic?1:0],
            );
            if(correctingClinic)steps.push(db.prepare(`UPDATE surplus_reports SET clinic_id=?,clinic_name=?,clinic_address=? WHERE id=? AND ${pending}`).bind(lot.clinicId??null,lot.clinicName??null,lot.clinicAddress?JSON.stringify(lot.clinicAddress):null,c.reportId,c.operationId));
            steps.push(
                db
                    .prepare(
                        `UPDATE surplus_reports SET status='reconciled',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND ${pending}`,
                    )
                    .bind(user.id, c.reportId, c.operationId),
            );
            steps.push(
                db
                    .prepare(`UPDATE surplus_forecasts SET status='reconciled' WHERE report_id=? AND ${pending}`)
                    .bind(c.reportId, c.operationId),
            );
        }
    } else if (c.kind === 'deduct') {
        if (!c.reason?.trim() || (isReviewer(user) && !c.requestRef?.trim())) fail('A request/reference and reason are required.');
        if (c.reason === 'Destruction') {
            if (!c.confirmerName?.trim() || !c.date || !validDate(c.date) || c.date > today)
                fail('Verified destruction date and staff name are required.');
            if (daysRemaining(lot!.expirationDate,today)>=45) fail('Only surplus with fewer than 45 days before expiration or expired stock can be destroyed.');
            const expiredStock=lot!.expirationDate<today;
            guard(expiredStock?'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expired_units>=?)':'EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND on_hand-reserved>=?)',[lot!.id,quantity]);
            update(expiredStock?'expired_units=expired_units-?':'on_hand=on_hand-?',[quantity]);
        } else {
            const donationWindowStart = new Date(Date.parse(today + 'T00:00:00Z') + 45 * 86400000).toISOString().slice(0, 10);
            const donationWindowEnd = new Date(Date.parse(today + 'T00:00:00Z') + 60 * 86400000).toISOString().slice(0, 10);
            if(c.reason==='Request fulfillment'&&daysRemaining(lot!.expirationDate,today)<=60)fail('Only surplus with more than 60 days before expiration can be used for a request.');
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND on_hand-reserved>=?)', [
                lot!.id, c.reason === 'Donation' ? donationWindowStart : today, quantity,
            ]);
            if (c.reason === 'Donation')
                guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date<=?)', [lot!.id, donationWindowEnd]);
            update('on_hand=on_hand-?', [quantity]);
        }
    } else if (c.kind === 'reserve') {
        if (
            !SEED_AGENCIES.some((a) => a.id === c.destinationAgencyId) ||
            !Number.isSafeInteger(c.destinationAgencyId) ||
            c.destinationAgencyId === lot!.agencyId ||
            !c.requestRef?.trim()
        )
            fail('A different destination agency and request reference are required.');
        const transferEligibilityDate=new Date(Date.parse(today+'T00:00:00Z')+61*86400000).toISOString().slice(0,10);
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND on_hand-reserved>=?)', [
            lot!.id,
            transferEligibilityDate,
            quantity,
        ]);
        update('reserved=reserved+?', [quantity]);
        transferId = crypto.randomUUID();
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_transfers(id,source_lot_id,source_agency_id,destination_agency_id,quantity,request_ref,formula_name,form,flavor,packaging,expiration_date,status) SELECT ?,?,?,?,?,?,?,?,?,?,?,'reserved' WHERE ${pending}`,
                )
                .bind(
                    transferId,
                    lot!.id,
                    lot!.agencyId,
                    c.destinationAgencyId,
                    quantity,
                    c.requestRef,
                    lot!.formulaName,
                    lot!.form,
                    lot!.flavor,
                        lot!.packaging??'',
                    lot!.expirationDate,
                    c.operationId,
                ),
        );
    } else if (['ship', 'receive', 'cancel'].includes(c.kind)) {
        const t = await db
            .prepare('SELECT * FROM surplus_transfers WHERE id=? AND source_lot_id=?')
            .bind(c.transferId ?? '', lot!.id)
            .first<any>();
        if (!t) fail('Transfer not found.');
        if(t.request_id)fail('Use the linked request transfer workflow for shipping, receipt or cancellation.');
        quantity = t.quantity;
        guard('EXISTS(SELECT 1 FROM surplus_transfers WHERE id=? AND source_lot_id=? AND status=?)', [
            t.id,
            lot!.id,
            c.kind === 'receive' ? 'shipped' : 'reserved',
        ]);
        if (c.kind === 'ship') {
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date>=? AND reserved>=?)', [
                lot!.id,
                today,
                quantity,
            ]);
            update('on_hand=on_hand-?,reserved=reserved-?', [quantity, quantity]);
        }
        if (c.kind === 'cancel') update('reserved=reserved-?', [quantity]);
        if (c.kind === 'receive') {
            const dest = await ensureSurplusLot(db, t.destination_agency_id, {
                formulaName: t.formula_name,
                form: t.form,
                flavor: t.flavor,
                packaging:t.packaging??'',
                expirationDate: t.expiration_date,
            });
            movementLot = dest.id;
            update(
                dest.expirationDate < today ? 'expired_units=expired_units+?' : 'on_hand=on_hand+?',
                [quantity],
                dest.id,
            );
        }
        steps.push(
            db
                .prepare(
                    `UPDATE surplus_transfers SET status=?,shipped_date=CASE WHEN ?='ship' THEN ? ELSE shipped_date END,received_date=CASE WHEN ?='receive' THEN ? ELSE received_date END,tracking_reference=CASE WHEN ?='ship' THEN ? ELSE tracking_reference END WHERE id=? AND ${pending}`,
                )
                .bind(
                    c.kind === 'ship' ? 'shipped' : c.kind === 'receive' ? 'received' : 'cancelled',
                    c.kind,
                    today,
                    c.kind,
                    today,
                    c.kind,
                    c.trackingReference ?? '',
                    t.id,
                    c.operationId,
                ),
        );
    } else if (c.kind === 'expire') {
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND expiration_date<? AND on_hand>0)', [lot!.id, today]);
        quantity = lot!.onHand;
        update('expired_units=expired_units+on_hand,on_hand=0,reserved=0');
        steps.push(
            db
                .prepare(
                    `INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units) SELECT ?||':'||t.id,?,l.id,'reservation-expired',t.quantity,?,t.request_ref,'Expiration released reservation',l.on_hand,l.reserved,l.expired_units FROM surplus_transfers t JOIN surplus_lots l ON l.id=t.source_lot_id WHERE l.id=? AND t.status='reserved' AND ${pending}`,
                )
                .bind(c.operationId, c.operationId, user.id, lot!.id, c.operationId),
        );
        steps.push(
            db
                .prepare(
                    `UPDATE surplus_transfers SET status='blocked-expired' WHERE source_lot_id=? AND status='reserved' AND ${pending}`,
                )
                .bind(lot!.id, c.operationId),
        );
    } else if (c.kind === 'correct-expiry') {
        if (
            !c.expirationDate ||
            !validDate(c.expirationDate) ||
            c.expirationDate < today ||
            !c.reason?.trim() ||
            !Number.isInteger(c.expectedVersion)
        )
            fail('Verified expiration date, version and correction reason required.');
        guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND version=? AND reserved=0)', [
            lot!.id,
            c.expectedVersion,
        ]);
        update('expiration_date=?,variant_key=?,on_hand=on_hand+expired_units,expired_units=0', [
            c.expirationDate,
            lotKey({ ...lot!, expirationDate: c.expirationDate! }),
        ]);
    } else if(c.kind==='correct-entry') {
        if(!Number.isSafeInteger(c.quantity)||c.quantity!<0||!c.reason?.trim()||!c.confirmerName?.trim()||!validDate(c.date??'')||c.date!>today||!Number.isInteger(c.expectedVersion))
            fail('A corrected whole-unit quantity, explanation, staff name, date and current inventory version are required.');
        const correctedFormulaName=c.correctedFormulaName?.trim().replace(/\s+/g,' ');
        const correctedForm=c.correctedForm;
        const correctedFlavor=c.correctedFlavor?.trim().replace(/\s+/g,' ')??'';
        if (c.correctedPackaging !== undefined && (typeof c.correctedPackaging !== 'string' || !correctedFormulaName))
            fail('Select a valid corrected formula package.');
        const correctedPackaging = c.correctedPackaging?.trim().replace(/\s+/g, ' ');
        if (correctedPackaging !== undefined && correctedPackaging !== (lot!.packaging ?? '') && lot!.reserved > 0)
            fail('Release reservations before correcting the package size.');
        const correctedExpirationDate = c.correctedExpirationDate === lot!.expirationDate ? undefined : c.correctedExpirationDate;
        if((c.correctedFormulaName!==undefined||c.correctedForm!==undefined||c.correctedFlavor!==undefined)&&(!correctedFormulaName||!['powder','concentrate','ready-to-feed'].includes(correctedForm??'')))
            fail('Enter a valid corrected formula name and form.');
        if (correctedExpirationDate !== undefined && !validDate(correctedExpirationDate)) fail('Enter a valid corrected expiration date.');
        if(correctedExpirationDate!==undefined&&correctedExpirationDate!==lot!.expirationDate&&lot!.reserved>0)fail('Release reservations before correcting the expiration date.');
        if(c.expectedVersion!==lot!.version)fail('Inventory changed. Refresh the inventory history and try again.');
        const previousCorrection=await db.prepare('SELECT corrected_quantity FROM surplus_movements WHERE corrects_movement_id=? ORDER BY rowid DESC LIMIT 1').bind(correctionTarget.id).first<any>();
        const effectiveQuantity=previousCorrection?.corrected_quantity??correctionTarget.quantity;
        const isCount=correctionTarget.kind==='reconcile';
        const balanceDelta=isCount?c.quantity!-effectiveQuantity:effectiveQuantity-c.quantity!;
        const correctedExpiry=correctedExpirationDate??lot!.expirationDate;
        const expired=correctedExpiry<today;
        const metadata=!!correctedFormulaName||correctedExpirationDate!==undefined;
        const formulaFields=correctedFormulaName?',formula_name=?,form=?,flavor=?':'';
        const expiryFields=correctedExpirationDate!==undefined?',expiration_date=?':'';
        const packageFields = correctedPackaging !== undefined ? ',packaging=?' : '';
        const packageArgs = correctedPackaging !== undefined ? [correctedPackaging] : [];
        const keyFields=metadata?',variant_key=?':'';
        const formulaArgs=correctedFormulaName?[correctedFormulaName,correctedForm,correctedFlavor]:[];
        const expiryArgs=correctedExpirationDate!==undefined?[correctedExpirationDate]:[];
        const finalKey=lotKey({formulaName:correctedFormulaName??lot!.formulaName,form:(correctedForm??lot!.form) as any,flavor:correctedFormulaName?correctedFlavor:lot!.flavor,packaging:correctedPackaging??lot!.packaging,expirationDate:correctedExpiry,clinicId:lot!.clinicId});
        if (metadata) {
            const matchingLot = await db.prepare('SELECT id FROM surplus_lots WHERE agency_id=? AND variant_key=? AND id<>?')
                .bind(lot!.agencyId, finalKey, lot!.id).first();
            if (matchingLot) fail('Another inventory lot already has these exact details at this clinic. The correction was not saved.');
        }
        if(expired){
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND reserved=0 AND on_hand+expired_units+?>=0)',[lot!.id,balanceDelta]);
            update('expired_units=on_hand+expired_units+?,on_hand=0'+formulaFields+packageFields+expiryFields+keyFields,[balanceDelta,...formulaArgs,...packageArgs,...expiryArgs,...(metadata?[finalKey]:[])]);
        }else{
            guard('EXISTS(SELECT 1 FROM surplus_lots WHERE id=? AND on_hand+expired_units+?>=reserved)',[lot!.id,balanceDelta]);
            update('on_hand=on_hand+expired_units+?,expired_units=0'+formulaFields+packageFields+expiryFields+keyFields,[balanceDelta,...formulaArgs,...packageArgs,...expiryArgs,...(metadata?[finalKey]:[])]);
        }
        quantity=Math.abs(balanceDelta);
        correctionOf=c.correctionOf;
        correctedQuantity=c.quantity!;
    } else fail('Unknown inventory action.');
    const result = { operationId: c.operationId, lotId: c.lotId, ...(transferId ? { transferId } : {}) };
    steps.push(
        db
            .prepare(
                `INSERT INTO surplus_movements(id,operation_id,lot_id,kind,quantity,actor_id,request_ref,reason,on_hand,reserved,expired_units,corrects_movement_id,corrected_quantity) SELECT ?,?,?,?,?,?,?,?,on_hand,reserved,expired_units,?,? FROM surplus_lots WHERE id=? AND ${pending}`,
            )
            .bind(
                crypto.randomUUID(),
                c.operationId,
                movementLot,
                c.kind,
                quantity,
                user.id,
                c.kind==='correct-entry'?correctionTarget.request_ref??'':c.requestRef??'',
                c.kind==='correct-entry'
                ? JSON.stringify({ reason:'Correction',note:c.reason,staff:c.confirmerName,date:c.date,correctedQuantity,...(c.correctedFormulaName!==undefined?{correctedFormulaName:c.correctedFormulaName,correctedForm:c.correctedForm,correctedFlavor:c.correctedFlavor??'',correctedPackaging:c.correctedPackaging}:{}),...(c.correctedExpirationDate!==undefined?{correctedExpirationDate:c.correctedExpirationDate}:{}) })
                    : JSON.stringify({ reason: c.reason ?? '', staff: c.confirmerName, date: c.date }),
                correctionOf??null,
                correctedQuantity,
                movementLot,
                c.operationId,
            ),
    );
    steps.push(
        db
            .prepare(`UPDATE surplus_commands SET status='done',result=? WHERE id=? AND status='pending'`)
            .bind(JSON.stringify(result), c.operationId),
    );
    steps.push(db.prepare('DELETE FROM surplus_guard'));
    try {
        await db.batch(steps);
    } catch {
        fail('Inventory changed or this action is not allowed. Refresh the inventory and try again.');
    }
    const saved = await db.prepare('SELECT * FROM surplus_commands WHERE id=?').bind(c.operationId).first<any>();
    if (saved.payload !== payload || saved.actor_id !== user.id) fail('Operation ID already used.');
    return JSON.parse(saved.result);
}
export async function expireSurplusLots(db: D1Database, today = localDate()) {
    const rows = await db
        .prepare(`SELECT ${columns} FROM surplus_lots WHERE expiration_date<? AND on_hand>0`)
        .bind(today)
        .all<SurplusLot>();
    for (const lot of rows.results.map(decodeSurplusLot)) {
        await executeSurplusCommand(
            db,
            { id: 0, role: 'admin', memberType: 'internal' } as SessionUser,
            { kind: 'expire', operationId: `expire:${lot.id}:${lot.expirationDate}:${lot.version}`, lotId: lot.id },
            today,
        );
    }
}
export async function listSurplus(db: D1Database, user: SessionUser) {
    await expireSurplusLots(db);
    const scope = isReviewer(user) ? '1=1' : 'agency_id=?';
    const query = (table: string) => {
        const s = db.prepare(`SELECT * FROM ${table} WHERE ${scope}`);
        return isReviewer(user) ? s : s.bind(user.agencyId ?? -1);
    };
    const lotList = `SELECT ${columns}, recordedAt FROM surplus_lots
        LEFT JOIN (
            SELECT lot_id, MIN(created_at) AS recordedAt
            FROM surplus_movements GROUP BY lot_id
        ) recorded ON recorded.lot_id = surplus_lots.id`;
    return {
        movements: (
            await db
                .prepare(
                    `SELECT m.*,l.agency_id,l.formula_name,l.form,l.flavor FROM surplus_movements m JOIN surplus_lots l ON l.id=m.lot_id WHERE (?=1 OR l.agency_id=?) ORDER BY m.created_at DESC,m.rowid DESC LIMIT 500`,
                )
                .bind(isReviewer(user) ? 1 : 0, user.agencyId ?? -1)
                .all<SurplusMovement>()
        ).results,
        lots: (
            await (
                isReviewer(user)
                    ? db.prepare(lotList)
                    : db.prepare(`${lotList} WHERE agency_id=?`).bind(user.agencyId ?? -1)
            ).all<SurplusLot>()
        ).results.map(decodeSurplusLot),
        reports: (await query('surplus_reports').all<SurplusReport>()).results,
        forecasts: (await query('surplus_forecasts').all<SurplusForecast>()).results,
        transfers: (
            await (
                isReviewer(user)
                    ? db.prepare('SELECT * FROM surplus_transfers')
                    : db
                          .prepare(
                              'SELECT * FROM surplus_transfers WHERE source_agency_id=? OR destination_agency_id=?',
                          )
                          .bind(user.agencyId ?? -1, user.agencyId ?? -1)
            ).all<SurplusTransfer>()
        ).results,
    };
}
