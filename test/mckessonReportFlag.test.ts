import { afterAll, expect, it, vi } from 'vitest';
import { reportFeatureFlags } from '../shared/featureFlags';
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('createError', (details: object) => Object.assign(new Error(), details));
vi.stubGlobal('setHeader', vi.fn());
afterAll(() => vi.unstubAllGlobals());
it('keeps McKesson reporting disabled unless explicitly enabled', () => {
    for (const value of [undefined, false, 'false', 'yes']) expect(reportFeatureFlags({ mckessonReport: value }).mckessonReport).toBe(false);
    for (const value of [true, 'true']) expect(reportFeatureFlags({ mckessonReport: value }).mckessonReport).toBe(true);
});
it.each(['mckesson-log.get', 'mckesson-log.csv.get', 'mckesson-log.xlsx.get'])('gates the %s endpoint', async route => {
    const handler = (await import(`../server/api/reports/${route}.ts`)).default;
    for (const value of [undefined, false, 'false']) {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { mckessonReport: value } }));
        await expect(Promise.resolve().then(() => handler({}))).rejects.toMatchObject({ statusCode: 404 });
    }
    for (const value of [true, 'true']) {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { mckessonReport: value } }));
        expect(await handler({})).toBeTruthy();
    }
});
