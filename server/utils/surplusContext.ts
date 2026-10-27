/// <reference path="../../worker-configuration.d.ts" />
import { createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { getSessionFromHeaders } from './session';
export function surplusContext(event: H3Event) {
    const env = event.context.cloudflare?.env as Partial<Env> | undefined;
    if (!env?.CDPHWIC || !env.PRESCRIPTIONS || !env.ENV)
        throw createError({ statusCode: 503, statusMessage: 'Surplus database unavailable.' });
    return {
        env: { ...env, CDPHWIC: env.CDPHWIC, PRESCRIPTIONS: env.PRESCRIPTIONS, ENV: env.ENV },
        db: env.CDPHWIC,
        user: getSessionFromHeaders({ 'x-demo-user': getHeader(event, 'x-demo-user') }),
    };
}
