import type {H3Event} from 'h3';
import {getRouterParam,createError} from 'h3';
import {surplusContext} from './surplusContext';
import {submittedRequest,ensureSubmittedRequest} from './submittedRequests';
import {getRequestById} from './requestStore';
import {canSeeAgency} from '../../shared/surplus';
export async function shipmentEvidenceContext(event:H3Event){
 const context=surplusContext(event);const id=Number(getRouterParam(event,'id'));
 const existing=await submittedRequest(context.db,id,context.user);const request=existing??getRequestById(id);
 if(!request||!canSeeAgency(context.user,request.agencyId))throw createError({statusCode:404});
 return {...context,request:existing??await ensureSubmittedRequest(context.db,request)};
}
