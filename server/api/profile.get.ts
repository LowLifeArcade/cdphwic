import { getDemoUser, type DemoIdentity } from '../utils/session';

export default defineEventHandler((event) => {
    const identity = (getHeader(event, 'x-demo-user') as DemoIdentity | undefined) ?? 'agency';
    return {
        user: getDemoUser(identity),
        assignments: { preferredInternalMemberId: 200, handledAgencyIds: [10, 11], handledRepIds: [100, 101] },
    };
});
