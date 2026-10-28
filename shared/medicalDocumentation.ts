export const medicalDocumentationRequiredMessage = 'Upload medical documentation before submitting.';

export function hasMedicalDocumentation(input: { temporaryKey?: string; fileSize?: number; existingKey?: string; removeExisting?: boolean }) {
    return Boolean(input.temporaryKey?.trim() || (input.fileSize ?? 0) > 0 || (!input.removeExisting && input.existingKey?.trim()));
}
