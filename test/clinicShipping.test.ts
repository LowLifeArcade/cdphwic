import { it, expect } from 'vitest';
import { surplusDb } from './helpers/surplusDb';
import { getDemoUser } from '../server/utils/session';
import { saveClinic, listClinics, resolveShipping } from '../server/utils/clinicStore';
import { validateShipping } from '../shared/shipping';
const address = {
    clinicName: 'North Clinic',
    addressLine1: '123 Test St',
    addressLine2: 'Suite 2',
    city: 'Ukiah',
    state: 'CA',
    postalCode: '95482',
};
it('requires a complete address without requiring Attention', () => {
    expect(validateShipping({ ...address, attention: 'Maria' })).toBe('');
    expect(validateShipping({ ...address })).toBe('');
    expect(validateShipping({ ...address, email: 'bad' })).toContain('E-Mail');
    expect(validateShipping({ ...address, phone: '123' })).toContain('Phone');
    expect(validateShipping({ ...address, email: 'clinic@example.com', phone: '(916) 555-0123' })).toBe('');
    expect(validateShipping({ ...address, attention: 'Maria', postalCode: 'bad' })).toContain('ZIP');
    expect(validateShipping(undefined)).toContain('Shipping');
});
it('persists agency clinics and blocks another agency and CDPH/WIC writes', async () => {
    const { db } = surplusDb();
    const agency = getDemoUser('agency');
    const clinic = await saveClinic(db, agency, 10, address);
    expect((await listClinics(db, agency, 10))[0]?.id).toBe(clinic.id);
    await expect(listClinics(db, { ...agency, agencyId: 11 }, 10)).rejects.toMatchObject({ statusCode: 403 });
    await expect(saveClinic(db, getDemoUser('internal'), 10, address)).rejects.toMatchObject({ statusCode: 403 });
    const resolved = await resolveShipping(db, agency, 10, {
        ...address,
        clinicId: clinic.id,
        addressLine1: 'Forged address',
        email: 'clinic@example.com',
        phone: '(916) 555-0123',
        attention: 'Maria',
    });
    expect(resolved.addressLine1).toBe('123 Test St');
    expect(resolved.email).toBe('clinic@example.com');
    expect(resolved.phone).toBe('(916) 555-0123');
    await expect(
        resolveShipping(db, { ...agency, agencyId: 11 }, 11, { ...address, clinicId: clinic.id, attention: 'Maria' }),
    ).rejects.toThrow();
});
it('retains a snapshot after an address-book entry changes', async () => {
    const { db } = surplusDb();
    const user = getDemoUser('agency');
    const clinic = await saveClinic(db, user, 10, address);
    const snapshot = await resolveShipping(db, user, 10, { ...address, clinicId: clinic.id, attention: 'Maria' });
    await saveClinic(db, user, 10, { ...address, addressLine1: '999 New St' }, clinic.id);
    expect(snapshot.addressLine1).toBe('123 Test St');
    expect((await listClinics(db, user, 10))[0]?.addressLine1).toBe('999 New St');
});
it('imports atomically and rejects incomplete rows', async () => {
    const { db } = surplusDb();
    const user = getDemoUser('agency');
    const { importClinics } = await import('../server/utils/clinicStore');
    await expect(importClinics(db, user, 10, [address, { ...address, postalCode: 'bad' }])).rejects.toThrow('Row 3');
    expect(await listClinics(db, user, 10)).toHaveLength(0);
    expect(await importClinics(db, user, 10, [address])).toBe(1);
});
it('preserves an archived clinic snapshot for edits and rejects it for new requests', async () => {
    const { db } = surplusDb();
    const user = getDemoUser('agency');
    const { archiveClinic } = await import('../server/utils/clinicStore');
    const clinic = await saveClinic(db, user, 10, address);
    const snapshot = await resolveShipping(db, user, 10, { ...address, clinicId: clinic.id, attention: 'Maria' });
    await archiveClinic(db, user, 10, clinic.id);
    expect(await listClinics(db, user, 10)).toHaveLength(0);
    expect((await resolveShipping(db, user, 10, { ...snapshot, attention: 'New rep' }, snapshot)).attention).toBe(
        'New rep',
    );
    await expect(resolveShipping(db, user, 10, snapshot)).rejects.toThrow();
});
it('resolves the CDPH/WIC demo identity to a non-admin internal member', () => {
    expect(getDemoUser('internal')).toMatchObject({ id: 3, role: 'member', memberType: 'internal' });
});
it('requires a representative in the selected agency and keeps unassigned drafts possible', async () => {
    const { requestAgency } = await import('../server/utils/requestAgency');
    expect(() => requestAgency(getDemoUser('admin'), 12, 100)).toThrow('belonging');
    expect(() => requestAgency(getDemoUser('internal'), 12, undefined, true)).toThrow('cannot create');
    expect(requestAgency(getDemoUser('admin'), 12, undefined, true)).toEqual({ agencyId: 12, agencyMemberId: 0 });
    expect(requestAgency(getDemoUser('agency'), 10, undefined)).toEqual({ agencyId: 10, agencyMemberId: 100 });
});
