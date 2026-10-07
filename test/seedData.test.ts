import { describe, expect, it } from 'vitest';
import { SEED_AGENCIES, SEED_MEMBERS, SEED_PRODUCTS, SEED_REQUESTS, SEED_USERS } from '../server/data/seed';

describe('dashboard seed data', () => {
    it('includes admin, agency, and internal demo users', () => {
        expect(SEED_USERS.map((user) => user.role)).toEqual(expect.arrayContaining(['admin', 'member']));
        expect(SEED_USERS.map((user) => user.memberType)).toEqual(expect.arrayContaining(['agency', 'internal']));
    });

    it('covers multiple agencies, representatives, products, and statuses', () => {
        expect(new Set(SEED_AGENCIES.map((agency) => agency.id)).size).toBeGreaterThan(1);
        expect(new Set(SEED_MEMBERS.map((member) => member.id)).size).toBeGreaterThan(1);
        expect(SEED_PRODUCTS.length).toBeGreaterThan(2);
        expect(new Set(SEED_REQUESTS.map((request) => request.status)).size).toBeGreaterThan(1);
    });
});
