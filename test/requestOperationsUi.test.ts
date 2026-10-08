import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const list = readFileSync(new URL('../app/components/RequestList.vue', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('../app/components/RequestDetailDrawer.vue', import.meta.url), 'utf8');

describe('request operations UI', () => {
    it('shows request type and submitted date while keeping identifiers in the drawer', () => {
        expect(list).toContain('request.requestKind');
        expect(list).toContain('Submitted {{ formatDate(request.submissionDate) }}');
        expect(list).not.toContain('Rep #{{ request.agencyMemberId }}');
        expect(list).not.toContain('<strong>#{{ request.id }}</strong>');
        expect(drawer).toContain('Request #{{ request.id }}');
        expect(drawer).toContain('request.requestKind');
    });

    it('supports staff editing, monthly allocations, and denial-only reasons', () => {
        expect(drawer).toContain('v-model.number="draft.ouncesPrescribed"');
        expect(drawer).toContain('v-model="issuance.month"');
        expect(drawer).toContain('Add benefit month');
        expect(drawer).toContain('v-if="draft.status === \'denied\'"');
        expect(drawer).toContain('authorization-form.pdf');
        expect(drawer).toContain('agency.shippingAddress');
        expect(drawer).toContain('rep?.email');
    });
});
