import { describe, expect, it } from 'vitest';
import { DEMO_USER_LABELS } from '../shared/demoIdentity';

describe('auth and profile demo contracts', () => {
    it('offers admin, agency, and internal demo identities', () => {
        expect(Object.keys(DEMO_USER_LABELS)).toEqual(expect.arrayContaining(['admin', 'agency', 'internal']));
    });

    it('keeps admin and member role concepts separate from member type', () => {
        expect(DEMO_USER_LABELS.admin.role).toBe('admin');
        expect(DEMO_USER_LABELS.agency.role).toBe('member');
        expect(DEMO_USER_LABELS.agency.memberType).toBe('agency');
        expect(DEMO_USER_LABELS.internal.memberType).toBe('internal');
    });
});
