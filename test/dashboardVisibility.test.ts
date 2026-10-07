import { describe, expect, it } from 'vitest';
import { getNavigationItems } from '../shared/navigation';
import type { SessionUser } from '../shared/domain';

const admin: SessionUser = { id: 1, name: 'Admin', role: 'admin', memberType: 'internal' };
const agency: SessionUser = {
    id: 2,
    name: 'Rep',
    role: 'member',
    memberType: 'agency',
    agencyId: 10,
    agencyMemberId: 100,
};

describe('dashboard navigation visibility', () => {
    it('shows admin-only links to admins', () => {
        const labels = getNavigationItems(admin).flatMap((item) => [
            item.label,
            ...(item.children?.map((child) => child.label) ?? []),
        ]);
        expect(labels).toContain('Reports');
        expect(labels).toContain('McKesson Log');
    });

    it('keeps admin-only links out of member navigation', () => {
        const labels = getNavigationItems(agency).flatMap((item) => [
            item.label,
            ...(item.children?.map((child) => child.label) ?? []),
        ]);
        expect(labels).not.toContain('Reports');
        expect(labels).not.toContain('McKesson Log');
        expect(labels).toContain('My Requests');
    });
});
