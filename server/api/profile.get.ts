import { getProfileAssignments } from '../utils/profileStore';
import { type DemoIdentity } from '../utils/session';

export default defineEventHandler((event) => {
    const identity = (getHeader(event, 'x-demo-user') as DemoIdentity | undefined) ?? 'agency';
    return getProfileAssignments(identity);
});
