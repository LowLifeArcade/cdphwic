const PHONE_ALLOWED_CHARACTERS = /^[\d\s()+.-]*$/;

export function normalizePhoneNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed || !PHONE_ALLOWED_CHARACTERS.test(trimmed)) {
        return '';
    }

    let digits = trimmed.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    return digits.length === 10 ? digits : '';
}

export function formatPhoneNumber(value: string) {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    if (digits.length > 10) {
        return digits;
    }
    if (digits.length <= 3) {
        return digits ? `(${digits}` : '';
    }
    if (digits.length <= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
