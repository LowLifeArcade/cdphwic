import type { SessionUser } from '../../shared/domain';
import {
    normalizeClinic,
    validateClinic,
    validateShipping,
    type ClinicAddress,
    type ClinicRecord,
    type RequestShipping,
} from '../../shared/shipping';
import { canSeeAgency } from '../../shared/surplus';
const fail = (statusCode: number, statusMessage: string) =>
    Object.assign(new Error(statusMessage), { statusCode, statusMessage });
export function clinicAccess(user: SessionUser, agencyId: number, write = false) {
    if (
        !Number.isSafeInteger(agencyId) ||
        agencyId <= 0 ||
        !canSeeAgency(user, agencyId) ||
        (user.role !== 'admin' && user.memberType === 'internal' && !user.handledAgencyIds?.includes(agencyId)) ||
        (write && user.role !== 'admin' && user.memberType !== 'agency')
    )
        throw fail(403, 'You cannot access this agency’s clinic address book.');
}
export async function listClinics(db: D1Database, user: SessionUser, agencyId: number): Promise<ClinicRecord[]> {
    clinicAccess(user, agencyId);
    const rows = await db
        .prepare(
            'SELECT id,agency_id,address_json FROM clinic_addresses WHERE agency_id=? AND active=1 ORDER BY created_at,id',
        )
        .bind(agencyId)
        .all<{ id: string; agency_id: number; address_json: string }>();
    return rows.results.map((r) => ({ ...JSON.parse(r.address_json), id: r.id, agencyId: r.agency_id }));
}
export async function saveClinic(
    db: D1Database,
    user: SessionUser,
    agencyId: number,
    input: Partial<ClinicAddress>,
    id?: string,
) {
    clinicAccess(user, agencyId, true);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'Enter a clinic address.');
    const address = normalizeClinic(input);
    address.state = address.state.toUpperCase();
    const error = validateClinic(address);
    if (error) throw fail(400, error);
    if (id) {
        const row = await db
            .prepare('SELECT id FROM clinic_addresses WHERE id=? AND agency_id=? AND active=1')
            .bind(id, agencyId)
            .first();
        if (!row) throw fail(404, 'Clinic address not found.');
        await db
            .prepare(
                'UPDATE clinic_addresses SET address_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND agency_id=?',
            )
            .bind(JSON.stringify(address), id, agencyId)
            .run();
    } else {
        id = crypto.randomUUID();
        await db
            .prepare('INSERT INTO clinic_addresses(id,agency_id,address_json) VALUES(?,?,?)')
            .bind(id, agencyId, JSON.stringify(address))
            .run();
    }
    return { ...address, id, agencyId };
}
export async function archiveClinic(db: D1Database, user: SessionUser, agencyId: number, id: string) {
    clinicAccess(user, agencyId, true);
    await db
        .prepare('UPDATE clinic_addresses SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND agency_id=?')
        .bind(id, agencyId)
        .run();
}
export async function importClinics(
    db: D1Database,
    user: SessionUser,
    agencyId: number,
    inputs: Partial<ClinicAddress>[],
) {
    clinicAccess(user, agencyId, true);
    if (!inputs.length || inputs.length > 500) throw fail(400, 'Upload between 1 and 500 clinic addresses.');
    const addresses = inputs.map((input, index) => {
        const a = normalizeClinic(input);
        a.state = a.state.toUpperCase();
        const error = validateClinic(a);
        if (error) throw fail(400, `Row ${index + 2}: ${error}`);
        return a;
    });
    await db.batch(
        addresses.map((a) =>
            db
                .prepare('INSERT INTO clinic_addresses(id,agency_id,address_json) VALUES(?,?,?)')
                .bind(crypto.randomUUID(), agencyId, JSON.stringify(a)),
        ),
    );
    return addresses.length;
}
export async function resolveShipping(
    db: D1Database,
    user: SessionUser,
    agencyId: number,
    input?: Partial<RequestShipping>,
    previous?: RequestShipping,
): Promise<RequestShipping> {
    clinicAccess(user, agencyId);
    // An unchanged snapshot remains valid even if the address book later changes or the clinic is archived.
    const addressKeys = Object.keys(blankAddress()) as (keyof ClinicAddress)[];
    let address = input;
    if (input?.clinicId) {
        const unchanged =
            previous?.clinicId === input.clinicId && addressKeys.every((key) => previous?.[key] === input[key]);
        if (!unchanged) {
            const row = await db
                .prepare('SELECT address_json FROM clinic_addresses WHERE id=? AND agency_id=? AND active=1')
                .bind(input.clinicId, agencyId)
                .first<{ address_json: string }>();
            if (!row) throw fail(400, 'Select a clinic address belonging to this local agency.');
            address = { ...JSON.parse(row.address_json), clinicId: input.clinicId, attention: input.attention };
        }
    }
    const normalized = {
        ...normalizeClinic(address ?? {}),
        ...(input?.clinicId ? { clinicId: input.clinicId } : {}),
        attention: typeof input?.attention === 'string' ? input.attention.trim() : '',
    };
    const error = validateShipping(normalized);
    if (error) throw fail(400, error);
    return normalized;
}
function blankAddress() {
    return { clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '' };
}
