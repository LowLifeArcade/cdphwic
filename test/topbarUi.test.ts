import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const topbar = readFileSync(new URL('../app/components/AppTopbar.vue', import.meta.url), 'utf8');

describe('top bar demo controls', () => {
    it('exposes the View as dropdown for each demo identity', () => {
        expect(topbar).toContain('View as');
        expect(topbar).toContain('<select');
        expect(topbar).toContain('value="admin"');
        expect(topbar).toContain('value="agency"');
        expect(topbar).toContain('value="internal"');
    });
});

describe('sidebar profile controls', () => {
    it('closes the profile menu on outside clicks and links the avatar to the profile page', () => {
        const sidebar = readFileSync(new URL('../app/components/AppSidebar.vue', import.meta.url), 'utf8');

        expect(sidebar).toContain('document.addEventListener');
        expect(sidebar).toContain("target.closest('.sidebar-footer')");
        expect(sidebar).toContain('to="/profile"');
        expect(sidebar).toContain('aria-label="View profile"');
    });
});
