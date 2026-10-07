import type { SessionUser } from './domain';

export interface NavigationItem {
    label: string;
    to: string;
    icon: string;
    children?: NavigationItem[];
}

export function getNavigationItems(user: SessionUser): NavigationItem[] {
    const items: NavigationItem[] = [
        { label: 'Summary', to: '/summary', icon: '◈' },
        {
            label: 'Requests',
            to: '/requests',
            icon: '▤',
            children: [{ label: 'My Requests', to: '/requests?scope=mine', icon: '↳' }],
        },
        { label: 'Products', to: '/products', icon: '◫' },
        { label: 'Participants', to: '/participants', icon: '◎' },
        { label: 'Agencies', to: '/agencies', icon: '⌂' },
    ];

    if (user.role === 'admin') {
        items.push(
            { label: 'Signup Requests', to: '/signup-requests', icon: '✉' },
            { label: 'Reports', to: '/reports', icon: '⌁' },
        );
    }

    return items;
}
