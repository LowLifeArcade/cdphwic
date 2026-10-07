import { describe, expect, it } from 'vitest';
import { maskEmail, validateAccessRequest, type InvitationType } from '../shared/accessFlow';

describe('closed access flow contracts', () => {
    it('masks invited email addresses without exposing the full value', () => {
        expect(maskEmail('maria@mendocino.example')).toBe('m***@mendocino.example');
    });

    it('requires the requested access identity and reason', () => {
        expect(validateAccessRequest({ name: '', email: 'bad', note: '' })).toEqual({
            name: 'Name is required.',
            email: 'Enter a valid email.',
            note: 'A reason for access is required.',
        });
    });

    it('uses only supported invitation types', () => {
        const types: InvitationType[] = ['agency_rep', 'staff'];
        expect(types).toHaveLength(2);
    });
});
