import { getDemoUser, type DemoIdentity } from '../utils/session';

export default defineEventHandler(async (event) => {
    const identity = (getHeader(event, 'x-demo-user') as DemoIdentity | undefined) ?? 'agency';
    const body = await readBody<Record<string, unknown>>(event);
    return {
        user: getDemoUser(identity),
        assignments: body,
        message: 'Profile assignments updated in development mode.',
        demo: true,
    };
});
