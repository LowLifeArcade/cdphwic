import type { FormulaEntry } from '#shared/formulaEntries';
import type { RequestShipping } from '#shared/shipping';
import type { RequestForm } from './requestForm';
import type { SubmissionContext } from './requestSubmissionBody';
type StoredForm = Record<string, string | number | boolean>;
interface DraftExtras {
    shipping: RequestShipping;
    submissionId: string;
    diagnosisInput: string;
    diagnosisDetails: string;
    additionalFormulas: FormulaEntry[];
    surplusEntries: SubmissionContext['surplusItems'];
    requestedMonths: string[];
}

/** Keep the persisted draft keys in one place; submission payloads use a different contract. */
export function serializeRequestDraft(form: RequestForm, extras: DraftExtras): StoredForm {
    return {
        ...form,
        _shipping: JSON.stringify(extras.shipping),
        _submissionId: extras.submissionId,
        _diagnosisInput: extras.diagnosisInput,
        _diagnosisDetails: extras.diagnosisDetails,
        _additionalFormulas: JSON.stringify(extras.additionalFormulas),
        _surplusEntries: JSON.stringify(extras.surplusEntries),
        _requestedMonths: JSON.stringify(extras.requestedMonths),
    };
}
export function restoreRequestDraft(stored: StoredForm) {
    const {
        _shipping,
        _submissionId,
        _diagnosisInput,
        _diagnosisDetails,
        _additionalFormulas,
        _surplusEntries,
        _requestedMonths,
        ...form
    } = stored;
    return {
        form,
        shipping: _shipping ? (JSON.parse(String(_shipping)) as RequestShipping) : undefined,
        submissionId: _submissionId ? String(_submissionId) : undefined,
        diagnosisInput: String(_diagnosisInput ?? ''),
        diagnosisDetails: String(_diagnosisDetails ?? ''),
        additionalFormulas: _additionalFormulas ? (JSON.parse(String(_additionalFormulas)) as FormulaEntry[]) : [],
        surplusEntries: _surplusEntries ? (JSON.parse(String(_surplusEntries)) as DraftExtras['surplusEntries']) : [],
        requestedMonths: _requestedMonths ? (JSON.parse(String(_requestedMonths)) as string[]) : [],
    };
}
