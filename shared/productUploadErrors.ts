export interface ProductUploadIssue {
    row?: number;
    column: string;
    cell?: string;
    value: string;
    formulaName?: string;
    message: string;
}

export function productUploadSummary(issues: ProductUploadIssue[]): string {
    const rows = new Set(issues.flatMap(issue => issue.row === undefined ? [] : [issue.row])).size;
    return `Upload blocked: ${issues.length} issue${issues.length === 1 ? '' : 's'}${rows ? ` across ${rows} row${rows === 1 ? '' : 's'}` : ''}. No products were added. Correct the listed cells and upload again.`;
}

export class ProductUploadError extends Error {
    constructor(public issues: ProductUploadIssue[]) {
        super(issues.map(issue => `${issue.row ? `Row ${issue.row}: ` : ''}${issue.column} — ${issue.message} Received: ${issue.value ? JSON.stringify(issue.value) : '(blank)'}.`).join('\n'));
        this.name = 'ProductUploadError';
    }
}

export function productUploadFailure(error: unknown): { message: string; issues: ProductUploadIssue[] } {
    const failure = error as { data?: { data?: { message?: string; issues?: ProductUploadIssue[] }; statusMessage?: string; message?: string }; statusMessage?: string } | undefined;
    const details = failure?.data?.data;
    return {
        message: details?.message ?? failure?.data?.statusMessage ?? failure?.data?.message ?? failure?.statusMessage ?? 'Products could not be uploaded. Check your connection and try again.',
        issues: Array.isArray(details?.issues) ? details.issues : [],
    };
}
