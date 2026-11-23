import type { RequestRecord, SessionUser } from '../../../shared/domain';
import { canSeeAgency } from '../../../shared/surplus';
import { conflict, nextRecord, writeRecord } from './persistence';

export function moreInfoReadHistory(previous: RequestRecord, user: SessionUser, noticeId?: string) {
    const reviewer = user.role === 'admin' || user.memberType === 'internal';
    const now = new Date().toISOString();
    return previous.moreInfoRequests?.map((note) => {
        if (note.deletedAt) {
            return note;
        }
        const initialRead =
            !reviewer &&
            !note.readAt &&
            (!noticeId ||
                noticeId === `followup:${note.id}` ||
                noticeId === `followup:${note.id}:reopen:${note.resubmissionOpenedAt}`);
        const reopenedRead =
            !reviewer &&
            note.resubmissionOpen &&
            !note.resubmissionReadAt &&
            (!noticeId || noticeId === `followup:${note.id}:reopen:${note.resubmissionOpenedAt}`);
        const responses = note.responses?.map((response) => {
            const incoming = reviewer ? response.respondedAs !== 'reviewer' : response.respondedAs === 'reviewer';
            return incoming && !response.readAt && (!noticeId || noticeId === `followup-response:${response.id}`)
                ? {
                      ...response,
                      readAt: now,
                      readBy: user.id,
                  }
                : response;
        });
        return {
            ...note,
            ...(initialRead
                ? {
                      readAt: now,
                      readBy: user.id,
                  }
                : {}),
            ...(reopenedRead
                ? {
                      resubmissionReadAt: now,
                      resubmissionReadBy: user.id,
                  }
                : {}),
            ...(responses
                ? {
                      responses,
                  }
                : {}),
        };
    });
}

export async function markMoreInfoRead(db: D1Database, previous: RequestRecord, user: SessionUser, noticeId?: string) {
    if (!canSeeAgency(user, previous.agencyId)) {
        throw Object.assign(new Error('Request not found.'), {
            statusCode: 404,
        });
    }
    if (user.role !== 'admin' && user.memberType !== 'internal' && user.memberType !== 'agency') {
        throw Object.assign(new Error('Not authorized.'), {
            statusCode: 403,
        });
    }
    let moreInfoRequests = moreInfoReadHistory(previous, user, noticeId);
    // Preserve notification reads recorded before message-level read receipts existed.
    const noticeIds = (previous.moreInfoRequests ?? []).flatMap((note) => [
        `followup:${note.id}`,
        ...(note.responses ?? []).map((response) => `followup-response:${response.id}`),
    ]);
    const reads = await db
        .prepare('SELECT notice_id FROM surplus_notice_reads WHERE notice_id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(noticeIds))
        .all<{
            notice_id: string;
        }>();
    const seen = new Set(reads.results.map((row) => row.notice_id));
    moreInfoRequests = moreInfoRequests?.map((note) =>
        seen.has(`followup:${note.id}`) ||
        note.responses?.some((response) => seen.has(`followup-response:${response.id}`))
            ? {
                  ...note,
                  deletionLocked: true,
              }
            : note,
    );
    const steps = moreInfoReadNoticeSteps(db, previous, user, noticeId);
    if (JSON.stringify(moreInfoRequests) === JSON.stringify(previous.moreInfoRequests)) {
        if (steps.length) {
            await db.batch(steps);
        }
        return previous;
    }
    return writeRecord(
        db,
        previous,
        nextRecord(previous, {
            moreInfoRequests,
        }),
        false,
        steps,
    );
}

export function moreInfoReadNoticeSteps(db: D1Database, previous: RequestRecord, user: SessionUser, noticeId?: string) {
    const reviewer = user.role === 'admin' || user.memberType === 'internal';
    const ids = (previous.moreInfoRequests ?? [])
        .filter((note) => !note.deletedAt)
        .flatMap((note) => [
            ...(!reviewer
                ? [
                      `followup:${note.id}`,
                      ...(note.resubmissionOpen && note.resubmissionOpenedAt
                          ? [`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`]
                          : []),
                  ]
                : []),
            ...(note.responses ?? [])
                .filter((response) =>
                    reviewer ? response.respondedAs !== 'reviewer' : response.respondedAs === 'reviewer',
                )
                .map((response) => `followup-response:${response.id}`),
        ])
        .filter((id) => !noticeId || id === noticeId);
    return ids.length
        ? [
              db
                  .prepare(
                      'INSERT OR IGNORE INTO surplus_notice_reads(notice_id,user_id) SELECT value,? FROM json_each(?)',
                  )
                  .bind(user.id, JSON.stringify(ids)),
          ]
        : [];
}

export async function readVisibleMoreInfoMessages(
    db: D1Database,
    previous: RequestRecord,
    user: SessionUser,
    noticeIds: string[],
    revision: number,
) {
    if (!canSeeAgency(user, previous.agencyId)) {
        throw Object.assign(new Error('Request not found.'), {
            statusCode: 404,
        });
    }
    if (revision !== (previous.revision ?? 0)) {
        throw conflict();
    }
    if (
        !Array.isArray(noticeIds) ||
        !noticeIds.length ||
        noticeIds.length > 20 ||
        noticeIds.some((id) => typeof id !== 'string')
    ) {
        throw Object.assign(new Error('Select valid messages.'), {
            statusCode: 400,
        });
    }
    const reviewer = user.role === 'admin' || user.memberType === 'internal';
    const allowed = new Set(
        (previous.moreInfoRequests ?? [])
            .filter((note) => !note.deletedAt)
            .flatMap((note) => [
                ...(!reviewer
                    ? [
                          `followup:${note.id}`,
                          ...(note.resubmissionOpen ? [`followup:${note.id}:reopen:${note.resubmissionOpenedAt}`] : []),
                      ]
                    : []),
                ...(note.responses ?? [])
                    .filter((response) => (response.respondedAs === 'reviewer') !== reviewer)
                    .map((response) => `followup-response:${response.id}`),
            ]),
    );
    if (noticeIds.some((id) => !allowed.has(id))) {
        throw Object.assign(new Error('Message not found.'), {
            statusCode: 404,
        });
    }
    let request = previous;
    for (const id of new Set(noticeIds)) {
        request = await markMoreInfoRead(db, request, user, id);
    }
    return request;
}
