export type DemoIdentity = 'admin' | 'agency' | 'internal';

export const DEMO_USER_LABELS: Record<
    DemoIdentity,
    { name: string; role: 'admin' | 'member'; memberType: 'internal' | 'agency' }
> = {
    admin: { name: 'Frank Browne', role: 'admin', memberType: 'internal' },
    agency: { name: 'Maria Lopez', role: 'member', memberType: 'agency' },
    internal: { name: 'James Kim', role: 'member', memberType: 'internal' },
};
