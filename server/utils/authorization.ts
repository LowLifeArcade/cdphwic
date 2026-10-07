import type { SessionUser } from '../../shared/domain';
import { canAccessAdminFeatures } from '../../shared/requestScope';

export function requireAdmin(user: SessionUser): SessionUser {
    if (!canAccessAdminFeatures(user)) {
        throw new Error('Admin access required');
    }

    return user;
}
