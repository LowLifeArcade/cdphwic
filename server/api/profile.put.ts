import { type DemoIdentity } from '../utils/session';
import { updateProfileAssignments } from '../utils/profileStore';

export default defineEventHandler(async (event) => {
    const identity = (getHeader(event, 'x-demo-user') as DemoIdentity | undefined) ?? 'agency';
    const body = await readBody<Record<string, unknown>>(event);
    return {
        ...updateProfileAssignments(identity, body as Parameters<typeof updateProfileAssignments>[1]),
        message: 'Profile assignments updated in development mode.',
        demo: true,
    };
});
