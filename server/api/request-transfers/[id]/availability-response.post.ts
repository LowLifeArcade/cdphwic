import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { recordTransferAvailabilityResponse } from '../../../utils/requestTransfers';
import { surplusContext } from '../../../utils/surplusContext';

export default defineEventHandler(async event => {
    const { db, user } = surplusContext(event);
    const body = await readBody<{ message?: unknown }>(event);
    await recordTransferAvailabilityResponse(db, getRouterParam(event, 'id') ?? '', user, body?.message);
    return { ok: true };
});
