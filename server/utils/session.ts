import { SEED_USERS } from '../data/seed';
import type { SessionUser } from '../../shared/domain';

export type DemoIdentity = 'admin' | 'agency' | 'internal';

export function getDemoUser(identity: DemoIdentity = 'admin'): SessionUser {
    const user =
        identity === 'admin'
            ? SEED_USERS.find((item) => item.role === 'admin')
            : SEED_USERS.find((item) => item.memberType === identity);

    if (!user) {
        throw new Error(`No demo user found for ${identity}`);
    }

    return structuredClone(user);
}

export function getSessionFromHeaders(headers: Record<string, string | undefined>): SessionUser {
    const demoIdentity = headers['x-demo-user'] as DemoIdentity | undefined;
    return getDemoUser(demoIdentity ?? 'admin');
}
