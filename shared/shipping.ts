export interface ClinicAddress {
    clinicName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
}
export interface ClinicRecord extends ClinicAddress {
    id: string;
    agencyId: number;
}
export interface RequestShipping extends ClinicAddress {
    clinicId?: string;
    attention?: string;
    email?: string;
    phone?: string;
}
export const blankClinicAddress = (): ClinicAddress => ({
    clinicName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'CA',
    postalCode: '',
});
export function normalizeClinic(input: Partial<ClinicAddress>): ClinicAddress {
    return Object.fromEntries(
        Object.keys(blankClinicAddress()).map((key) => [key, String(input[key as keyof ClinicAddress] ?? '').trim()]),
    ) as unknown as ClinicAddress;
}
export function validateClinic(input?: Partial<ClinicAddress>): string {
    if (!input) return 'Complete the Shipping address.';
    if (
        ![input.clinicName, input.addressLine1, input.city, input.state, input.postalCode].every(
            (v) => typeof v === 'string' && v.trim(),
        )
    )
        return 'Complete Clinic Name, Street Address, City, State, and ZIP Code.';
    if (Object.values(input).some((v) => typeof v === 'string' && v.length > 250))
        return 'Address fields must be 250 characters or fewer.';
    if (!/^[A-Za-z]{2}$/.test(input.state!)) return 'Enter a two-letter State.';
    if (!/^\d{5}(?:-\d{4})?$/.test(input.postalCode!)) return 'Enter a valid ZIP Code.';
    return '';
}
export function validateShipping(input?: Partial<RequestShipping>): string {
    const error = validateClinic(input);
    if (error) return error;
    if (input?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'Enter a valid Shipping E-Mail.';
    if (input?.email && input.email.length > 254) return 'Shipping E-Mail must be 254 characters or fewer.';
    if (input?.phone && !/^(?:1)?\d{10}$/.test(input.phone.replace(/\D/g, ''))) return 'Enter a valid Shipping Phone Number.';
    return '';
}
export function formatClinic(address: ClinicAddress) {
    return `${address.clinicName} — ${address.addressLine1}${address.addressLine2 ? ', ' + address.addressLine2 : ''}, ${address.city}, ${address.state} ${address.postalCode}`;
}

export function formatShippingAddress(address?: Partial<ClinicAddress>): string {
    if (!address) return '—';
    return [address.addressLine1, address.addressLine2, address.city].filter(Boolean).join(', ') || '—';
}
