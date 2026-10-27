export type Appearance = 'light' | 'dark' | 'auto';
export function normalizeAppearance(value: unknown): Appearance {
    return value === 'light' || value === 'dark' ? value : 'auto';
}
export function resolveAppearance(preference: Appearance, systemDark: boolean): 'light' | 'dark' {
    return preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;
}
// Runs in the document head before styles paint, including on a direct page load.
export const appearanceInitScript = `(()=>{const match=document.cookie.match(/(?:^|; )appearance=([^;]*)/);const preference=match?decodeURIComponent(match[1]):'auto';const theme=preference==='dark'||preference!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',theme);})();`;
