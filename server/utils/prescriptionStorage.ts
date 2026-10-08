export const MAX_PRESCRIPTION_BYTES = 10 * 1024 * 1024;

const MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

type MultipartFile = {
    data?: Uint8Array;
    filename?: string;
    type?: string;
};

export function getPrescriptionContentType(type = '', filename = ''): string | undefined {
    if (type) {
        return MIME_TYPES.has(type) ? type : undefined;
    }

    const extension = filename.toLowerCase().split('.').pop();
    const byExtension: Record<string, string> = {
        pdf: 'application/pdf',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
    };
    return extension ? byExtension[extension] : undefined;
}

export function hasValidPrescriptionSignature(data: Uint8Array, contentType: string) {
    if (contentType === 'application/pdf') {
        return new TextDecoder().decode(data.slice(0, 5)) === '%PDF-';
    }
    if (contentType === 'image/jpeg') {
        return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    }
    if (contentType === 'image/png') {
        return [0x89, 0x50, 0x4e, 0x47].every((value, index) => data[index] === value);
    }
    if (contentType === 'image/webp') {
        return new TextDecoder().decode(data.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(data.slice(8, 12)) === 'WEBP';
    }
    return false;
}

export function makePrescriptionStorageKey(environment: string, requestId: number, filename: string, uploadId: string) {
    const safeFilename = filename
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'prescription';
    return `${environment}/requests/${requestId}/${uploadId}-${safeFilename}`;
}

export async function storePrescriptionAttachment(
    bucket: R2Bucket,
    environment: string,
    requestId: number,
    file: MultipartFile,
) {
    const contentType = getPrescriptionContentType(file.type, file.filename);
    if (!contentType) {
        throw new Error('Use a PDF, JPG, PNG, or WEBP prescription.');
    }
    if (!file.data?.byteLength) {
        throw new Error('The prescription file is empty.');
    }
    if (file.data.byteLength > MAX_PRESCRIPTION_BYTES) {
        throw new Error('Prescription files must be 10 MB or smaller.');
    }
    if (!hasValidPrescriptionSignature(file.data, contentType)) {
        throw new Error('The uploaded file does not match its declared PDF or image type.');
    }

    const key = makePrescriptionStorageKey(environment, requestId, file.filename ?? 'prescription', crypto.randomUUID());
    await bucket.put(key, file.data, {
        httpMetadata: { contentType },
        customMetadata: {
            requestId: String(requestId),
            originalFileName: (file.filename ?? 'prescription').slice(0, 255),
        },
    });
    return { key, contentType, size: file.data.byteLength, fileName: file.filename ?? 'prescription' };
}

export async function storeTemporaryPrescriptionAttachment(bucket: R2Bucket, environment: string, file: MultipartFile) {
    const contentType = getPrescriptionContentType(file.type, file.filename);
    if (!contentType) {
        throw new Error('Use a PDF, JPG, PNG, or WEBP prescription.');
    }
    if (!file.data?.byteLength) {
        throw new Error('The prescription file is empty.');
    }
    if (file.data.byteLength > MAX_PRESCRIPTION_BYTES) {
        throw new Error('Prescription files must be 10 MB or smaller.');
    }
    if (!hasValidPrescriptionSignature(file.data, contentType)) {
        throw new Error('The uploaded file does not match its declared PDF or image type.');
    }

    const fileName = file.filename ?? 'prescription';
    const safeFileName = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'prescription';
    const key = `temporary/${environment}/${crypto.randomUUID()}-${safeFileName}`;
    await bucket.put(key, file.data, {
        httpMetadata: { contentType },
        customMetadata: { originalFileName: fileName.slice(0, 255), temporary: 'true' },
    });
    return { key, contentType, size: file.data.byteLength, fileName };
}

export async function promoteTemporaryPrescriptionAttachment(
    bucket: R2Bucket,
    environment: string,
    requestId: number,
    temporaryKey: string,
) {
    const prefix = `temporary/${environment}/`;
    if (!temporaryKey.startsWith(prefix)) {
        throw new Error('Invalid prescription upload.');
    }
    const source = await bucket.get(temporaryKey);
    if (!source?.body) {
        throw new Error('The temporary prescription upload is no longer available.');
    }
    const contentType = source.httpMetadata?.contentType;
    const fileName = source.customMetadata?.originalFileName ?? 'prescription';
    if (!contentType || !MIME_TYPES.has(contentType)) {
        throw new Error('The temporary prescription upload is invalid.');
    }
    const key = makePrescriptionStorageKey(environment, requestId, fileName, crypto.randomUUID());
    await bucket.put(key, source.body, {
        httpMetadata: { contentType },
        customMetadata: { requestId: String(requestId), originalFileName: fileName },
    });
    return { key, sourceKey: temporaryKey, contentType, size: source.size, fileName };
}
