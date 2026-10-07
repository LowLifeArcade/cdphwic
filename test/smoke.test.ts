import { describe, expect, it } from 'vitest';
import { CDPHWIC_SCAFFOLD } from '../shared/scaffold';

describe('CDPHWIC scaffold contract', () => {
    it('identifies the project and Cloudflare D1 binding', () => {
        expect(CDPHWIC_SCAFFOLD).toEqual({
            name: 'cdphwic',
            d1Binding: 'CDPHWIC',
        });
    });
});
