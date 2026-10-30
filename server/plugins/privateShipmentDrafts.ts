import {getHeader} from 'h3';
import {getSessionFromHeaders} from '../utils/session';
import {isReviewer} from '../../shared/surplus';
import {withoutShipmentDrafts} from '../../shared/shipmentPublishing';
// Apply to all request responses, including receipts, issue reports and evidence uploads.
export default defineNitroPlugin(nitro=>{
 nitro.hooks.hook('beforeResponse',(event,response)=>{
  if(!event.path.startsWith('/api/requests'))return;
  const user=getSessionFromHeaders({'x-demo-user':getHeader(event,'x-demo-user')});
  if(isReviewer(user)||!response.body||typeof response.body!=='object')return;
  const body=response.body as {request?:import('../../shared/domain').RequestRecord;requests?:import('../../shared/domain').RequestRecord[]};
  response.body={...body,...(body.request?{request:withoutShipmentDrafts(body.request)}:{}),...(body.requests?{requests:body.requests.map(withoutShipmentDrafts)}:{})};
 });
});
