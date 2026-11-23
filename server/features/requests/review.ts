import type { RequestRecord, SessionUser } from '../../../shared/domain';
import { getApprovalStatus } from '../../../shared/requestOperations';
import { conflict, nextRecord, writeRecord } from './persistence';

export interface ReviewDecisionCommand {
    action: 'approve' | 'deny' | 'reopen' | 'clear' | 'request-info';
    reason?: string;
    notes?: string;
}

export async function reviewSubmittedRequest(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    command: ReviewDecisionCommand,
    revision: number,
) {
    if (user.role !== 'admin' && user.memberType !== 'internal') {
        throw Object.assign(new Error('Only CDPH/WIC or Admin can make review decisions.'), {
            statusCode: 403,
            statusMessage: 'Only CDPH/WIC or Admin can make review decisions.',
        });
    }
    if (!command || !['approve', 'deny', 'reopen', 'clear', 'request-info'].includes(command.action)) {
        throw Object.assign(new Error('Select a valid review decision.'), {
            statusCode: 400,
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (command.action === 'reopen') {
        if (previous.status !== 'denied') {
            throw conflict('Only a denied request can be reopened.');
        }
        return writeRecord(
            db,
            previous,
            nextRecord(previous, {
                status: 'in_progress',
                approved: false,
                approvedByName: undefined,
            }),
            false,
        );
    }
    if (command.action === 'clear') {
        if (previous.status !== 'denied' && previous.status !== 'approved' && previous.approved !== true) {
            throw conflict('There is no saved review decision to clear.');
        }
        return writeRecord(
            db,
            previous,
            nextRecord(previous, {
                status:
                    previous.status === 'denied' || previous.status === 'approved' ? 'in_progress' : previous.status,
                approved: false,
                approvedByName: undefined,
                denialReason: undefined,
            }),
            false,
        );
    }
    if (command.action === 'request-info') {
        return requestMoreInfo(db, previous, user, command.notes!, revision);
    }
    if (
        command.action === 'deny' &&
        (typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 4000)
    ) {
        throw Object.assign(new Error('Enter a reason for denial.'), {
            statusCode: 400,
            statusMessage: 'Enter a reason for denial.',
        });
    }
    const now = new Date().toISOString();
    const moreInfoRequests = previous.moreInfoRequests?.map((note) =>
        note.deletedAt || note.resolvedAt
            ? note
            : {
                  ...note,
                  resubmissionOpen: false,
                  resolvedAt: now,
                  resolvedBy: user.id,
              },
    );
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            approved: command.action === 'approve',
            approvedByName: command.action === 'approve' ? user.name : undefined,
            status: command.action === 'deny' ? 'denied' : getApprovalStatus(previous.status),
            ...(command.action === 'deny'
                ? {
                      denialReason: command.reason!.trim(),
                  }
                : {}),
            moreInfoRequests,
        }),
        false,
    );
}

export async function requestMoreInfo(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    notes: string,
    revision: number,
) {
    if (user.role !== 'admin' && user.memberType !== 'internal') {
        throw Object.assign(new Error('Only CDPH/WIC or Admin can request more information.'), {
            statusCode: 403,
        });
    }
    if (typeof notes !== 'string' || !notes.trim() || notes.length > 4000) {
        throw Object.assign(new Error('Enter notes describing what needs to be addressed.'), {
            statusCode: 400,
            statusMessage: 'Enter notes describing what needs to be addressed.',
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    const moreInfoRequests = [
        ...(previous.moreInfoRequests ?? []),
        {
            id: crypto.randomUUID(),
            notes: notes.trim(),
            requestedAt: new Date().toISOString(),
            requestedBy: user.id,
            statusBeforeRequest: previous.status === 'unopened' ? ('opened' as const) : previous.status,
            originalSurplusItems: structuredClone(previous.surplusItems ?? []),
        },
    ];
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            status: 'needs_info',
            moreInfoRequests,
        }),
        false,
    );
}
