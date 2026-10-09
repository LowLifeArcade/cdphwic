import { describe, expect, it } from 'vitest';
import { formatPhoneNumber, normalizePhoneNumber } from '../shared/phone';

describe('phone number formatting', () => {
    it('normalizes common US phone input to ten digits', () => {
        expect(normalizePhoneNumber('(916) 555-0123')).toBe('9165550123');
        expect(normalizePhoneNumber('916-555-0123')).toBe('9165550123');
        expect(normalizePhoneNumber('+1 (916) 555-0123')).toBe('9165550123');
    });

    it('formats normalized phone values for display', () => {
        expect(formatPhoneNumber('9165550123')).toBe('(916) 555-0123');
        expect(formatPhoneNumber('916555')).toBe('(916) 555');
        expect(formatPhoneNumber('916')).toBe('(916');
    });

    it('rejects incomplete or invalid phone values', () => {
        expect(normalizePhoneNumber('916-555')).toBe('');
        expect(normalizePhoneNumber('abc')).toBe('');
        expect(normalizePhoneNumber('2 (916) 555-0123')).toBe('');
    });
});
