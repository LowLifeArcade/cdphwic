import { getDemoUser, type DemoIdentity } from '../../utils/session';

export default defineEventHandler(async (event) => {
    const body = await readBody<{ identity?: DemoIdentity }>(event);
    const identity = body?.identity ?? 'agency';
    return { user: getDemoUser(identity), demo: true };
});
