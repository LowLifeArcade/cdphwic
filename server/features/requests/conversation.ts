import type { RequestRecord, SessionUser } from '../../../shared/domain';
import { unreadOutgoingMessage } from '../../../shared/moreInfoMessages';
import {
    canReplyToMoreInfo,
    canReopenMoreInfo,
    canResolveMoreInfo,
    hasPendingMoreInfo,
    latestMoreInfoRequest,
} from '../../../shared/requestEditing';
import { canSeeAgency } from '../../../shared/surplus';
import { conflict, nextRecord, writeRecord } from './persistence';
import { moreInfoReadHistory, moreInfoReadNoticeSteps } from './messageReads';

export interface MoreInfoNoteCommand {
    noteId: string;
    action: 'edit' | 'delete';
    notes?: string;
}

export async function editMoreInfoNote(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    command: MoreInfoNoteCommand,
    revision: number,
) {
    if (user.role !== 'admin' && user.memberType !== 'internal') {
        throw Object.assign(new Error('Only CDPH/WIC or Admin can edit or delete these notes.'), {
            statusCode: 403,
            statusMessage: 'Only CDPH/WIC or Admin can edit or delete these notes.',
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (!command || !['edit', 'delete'].includes(command.action)) {
        throw Object.assign(new Error('Select a valid note action.'), {
            statusCode: 400,
        });
    }
    const note = previous.moreInfoRequests?.find((entry) => entry.id === command.noteId && !entry.deletedAt);
    if (!note) {
        throw Object.assign(new Error('Note not found.'), {
            statusCode: 404,
            statusMessage: 'Note not found.',
        });
    }
    const noticeIds = [
        `followup:${note.id}`,
        ...(note.responses ?? []).map((response) => `followup-response:${response.id}`),
    ];
    const reads = await db
        .prepare(
            'SELECT notice_id FROM surplus_notice_reads WHERE notice_id IN (SELECT value FROM json_each(?)) LIMIT 1',
        )
        .bind(JSON.stringify(noticeIds))
        .first();
    if (note.deletionLocked || note.readAt || note.responses?.some((response) => response.readAt) || reads) {
        throw Object.assign(new Error('A message that has been read cannot be edited or deleted.'), {
            statusCode: 409,
            statusMessage: 'A message that has been read cannot be edited or deleted.',
        });
    }
    if (
        command.action === 'edit' &&
        (typeof command.notes !== 'string' || !command.notes.trim() || command.notes.length > 4000)
    ) {
        throw Object.assign(new Error('Enter a note of up to 4000 characters.'), {
            statusCode: 400,
            statusMessage: 'Enter a note of up to 4000 characters.',
        });
    }
    const now = new Date().toISOString();
    const moreInfoRequests = previous.moreInfoRequests!.map((entry) =>
        entry.id !== note.id
            ? entry
            : command.action === 'delete'
              ? {
                    ...entry,
                    resubmissionOpen: false,
                    deletedAt: now,
                    deletedBy: user.id,
                }
              : {
                    ...entry,
                    notes: command.notes!.trim(),
                    editedAt: now,
                    editedBy: user.id,
                    noteHistory: [
                        ...(entry.noteHistory ?? []),
                        {
                            notes: entry.notes,
                            changedAt: now,
                            changedBy: user.id,
                        },
                    ],
                },
    );
    const steps =
        command.action === 'edit'
            ? [db.prepare('DELETE FROM surplus_notice_reads WHERE notice_id=?').bind(`followup:${note.id}`)]
            : [];
    const withdrawing =
        command.action === 'delete' &&
        note.id === latestMoreInfoRequest(previous)?.id &&
        previous.status === 'needs_info';
    const stillPending = hasPendingMoreInfo({
        status: 'needs_info',
        moreInfoRequests,
    });
    const status =
        withdrawing && !stillPending
            ? note.statusBeforeRequest && note.statusBeforeRequest !== 'needs_info'
                ? note.statusBeforeRequest
                : 'in_progress'
            : previous.status;
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            moreInfoRequests,
            status,
        }),
        false,
        steps,
    );
}

export interface MoreInfoReply {
    noteId: string;
    notes: string;
}

export async function replyToMoreInfo(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    reply: MoreInfoReply,
    revision: number,
) {
    const reviewer = user.role === 'admin' || user.memberType === 'internal';
    if (!reviewer && user.memberType !== 'agency') {
        throw Object.assign(new Error('Only CDPH/WIC, Admin or the Local Agency can respond.'), {
            statusCode: 403,
            statusMessage: 'Only CDPH/WIC, Admin or the Local Agency can respond.',
        });
    }
    if (!canSeeAgency(user, previous.agencyId)) {
        throw Object.assign(new Error('Request not found.'), {
            statusCode: 404,
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (!reply || typeof reply.notes !== 'string' || !reply.notes.trim() || reply.notes.length > 4000) {
        throw Object.assign(new Error('Enter an answer of up to 4000 characters.'), {
            statusCode: 400,
            statusMessage: 'Enter an answer of up to 4000 characters.',
        });
    }
    const note = previous.moreInfoRequests?.find(
        (entry) => entry.id === reply.noteId && !entry.deletedAt && !entry.resolvedAt,
    );
    if (!canReplyToMoreInfo(previous, reply.noteId) || !note) {
        throw Object.assign(new Error('This information request is no longer awaiting a response.'), {
            statusCode: 409,
            statusMessage: 'This information request is no longer awaiting a response.',
        });
    }
    const outgoing = unreadOutgoingMessage(note, reviewer);
    if (outgoing) {
        const id = outgoing.type === 'initial' ? `followup:${note.id}` : `followup-response:${outgoing.id}`;
        const read = await db
            .prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id=? LIMIT 1')
            .bind(id)
            .first();
        if (!read) {
            throw Object.assign(new Error('Edit your unread message instead of sending another.'), {
                statusCode: 409,
                statusMessage: 'Edit your unread message instead of sending another.',
            });
        }
    }
    const response = {
        id: crypto.randomUUID(),
        notes: reply.notes.trim(),
        respondedAt: new Date().toISOString(),
        respondedBy: user.id,
        respondedAs: reviewer ? ('reviewer' as const) : ('agency' as const),
    };
    const readHistory = moreInfoReadHistory(previous, user);
    const moreInfoRequests = readHistory!.map((entry) =>
        entry.id === note.id
            ? {
                  ...entry,
                  responses: [...(entry.responses ?? []), response],
              }
            : entry,
    );
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            moreInfoRequests,
        }),
        false,
        moreInfoReadNoticeSteps(db, previous, user),
    );
}

export async function resolveMoreInfo(db: D1Database, previous: RequestRecord, user: SessionUser, revision: number) {
    if (user.role !== 'admin' && user.memberType !== 'internal') {
        throw Object.assign(new Error('Only CDPH/WIC or Admin can resolve information requests.'), {
            statusCode: 403,
            statusMessage: 'Only CDPH/WIC or Admin can resolve information requests.',
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (!canResolveMoreInfo(previous)) {
        throw Object.assign(new Error('There are no outstanding information requests.'), {
            statusCode: 409,
            statusMessage: 'There are no outstanding information requests.',
        });
    }
    const now = new Date().toISOString();
    const moreInfoRequests = previous.moreInfoRequests!.map((entry) =>
        entry.resolvedAt
            ? entry
            : {
                  ...entry,
                  resubmissionOpen: false,
                  resolvedAt: now,
                  resolvedBy: user.id,
              },
    );
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            status: 'in_progress',
            moreInfoRequests,
        }),
        false,
    );
}

export async function reopenMoreInfoSubmission(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    revision: number,
) {
    if (user.role !== 'admin' && user.memberType !== 'internal') {
        throw Object.assign(new Error('Only CDPH/WIC or Admin can reopen a request for resubmission.'), {
            statusCode: 403,
            statusMessage: 'Only CDPH/WIC or Admin can reopen a request for resubmission.',
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (!canReopenMoreInfo(previous)) {
        throw Object.assign(new Error('This information request cannot be reopened for resubmission.'), {
            statusCode: 409,
            statusMessage: 'This information request cannot be reopened for resubmission.',
        });
    }
    const moreInfoRequests = previous.moreInfoRequests!.map((entry) =>
        entry.id === latestMoreInfoRequest(previous)?.id
            ? {
                  ...entry,
                  resubmissionOpen: true,
                  resubmissionReadAt: undefined,
                  resubmissionReadBy: undefined,
                  resubmissionOpenedAt: new Date().toISOString(),
                  resubmissionOpenedBy: user.id,
                  originalSurplusItems: structuredClone(previous.surplusItems ?? []),
              }
            : entry,
    );
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

export interface MoreInfoMessageEdit {
    noteId: string;
    responseId: string;
    notes: string;
}

export async function editMoreInfoMessage(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    command: MoreInfoMessageEdit,
    revision: number,
) {
    if (!canSeeAgency(user, previous.agencyId)) {
        throw Object.assign(new Error('Request not found.'), {
            statusCode: 404,
        });
    }
    const reviewer = user.role === 'admin' || user.memberType === 'internal';
    if (!reviewer && user.memberType !== 'agency') {
        throw Object.assign(new Error('Not authorized.'), {
            statusCode: 403,
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    const note = previous.moreInfoRequests?.find((entry) => entry.id === command?.noteId && !entry.deletedAt);
    const response = note?.responses?.find((entry) => entry.id === command?.responseId);
    if (!note || !response) {
        throw Object.assign(new Error('Message not found.'), {
            statusCode: 404,
        });
    }
    if ((response.respondedAs === 'reviewer') !== reviewer) {
        throw Object.assign(new Error('Only the sender can edit this message.'), {
            statusCode: 403,
            statusMessage: 'Only the sender can edit this message.',
        });
    }
    const read = await db
        .prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id=? LIMIT 1')
        .bind(`followup-response:${response.id}`)
        .first();
    if (response.readAt || read || !canReplyToMoreInfo(previous, note.id)) {
        throw Object.assign(new Error('A read or resolved message cannot be edited.'), {
            statusCode: 409,
            statusMessage: 'A read or resolved message cannot be edited.',
        });
    }
    if (typeof command.notes !== 'string' || !command.notes.trim() || command.notes.length > 4000) {
        throw Object.assign(new Error('Enter a message of up to 4000 characters.'), {
            statusCode: 400,
            statusMessage: 'Enter a message of up to 4000 characters.',
        });
    }
    const now = new Date().toISOString();
    const moreInfoRequests = previous.moreInfoRequests!.map((entry) =>
        entry.id === note.id
            ? {
                  ...entry,
                  responses: entry.responses!.map((item) =>
                      item.id === response.id
                          ? {
                                ...item,
                                notes: command.notes.trim(),
                                editedAt: now,
                                editedBy: user.id,
                                noteHistory: [
                                    ...(item.noteHistory ?? []),
                                    {
                                        notes: item.notes,
                                        changedAt: now,
                                        changedBy: user.id,
                                    },
                                ],
                            }
                          : item,
                  ),
              }
            : entry,
    );
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            moreInfoRequests,
        }),
        false,
    );
}
