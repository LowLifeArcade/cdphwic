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

    it('includes request-detail workflow examples for requested months, processing, shipment, and surplus', () => {
        expect(SEED_REQUESTS.some((request) => request.benefitMonthsRequested?.length)).toBe(true);
        expect(SEED_REQUESTS.some((request) => request.approvedCases !== undefined && request.casesOrdered !== undefined)).toBe(true);
        expect(SEED_REQUESTS.some((request) => request.trackingNumbers?.length && request.receivedStatus === 'received')).toBe(true);
        expect(SEED_REQUESTS.some((request) => request.surplusItems?.length)).toBe(true);
        expect(SEED_REQUESTS.some((request) => request.receivedStatus === 'damaged' || request.receivedStatus === 'missing')).toBe(true);
    });

    it('keeps lifecycle fields consistent with request status', () => {
        const unopened = SEED_REQUESTS.find((request) => request.status === 'unopened');
        expect(unopened).toBeDefined();
        expect(unopened?.assignedInternalMemberId).toBeUndefined();
        expect(unopened?.approvedCases).toBeUndefined();
        expect(unopened?.eta).toBeUndefined();

        expect(SEED_REQUESTS.filter((request) => request.status !== 'shipped').every((request) => request.eta === undefined)).toBe(true);
        expect(SEED_REQUESTS.filter((request) => request.status === 'shipped').every((request) => request.eta && request.trackingNumbers?.length)).toBe(true);
        expect(SEED_REQUESTS.filter((request) => request.status === 'denied').every((request) => request.staffNotes || request.comments)).toBe(true);
    });
});
