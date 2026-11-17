import {describe,expect,it,vi} from 'vitest';

vi.mock('h3',async importOriginal=>{
 const actual=await importOriginal<typeof import('h3')>();
 return {...actual,defineEventHandler:(handler:unknown)=>handler,readBody:async(event:any)=>event.body,createError:(details:any)=>Object.assign(new Error(details.statusMessage),details),getHeader:(event:any,name:string)=>event.identity};
});
const {default:postCommand}=await import('../server/api/surplus/commands.post');

describe('surplus command route physical count policy',()=>{
 it('prevents CDPH/WIC from entering direct physical counts',async()=>{
  const event={identity:'internal',body:{kind:'reconcile',lotId:'lot',quantity:4},context:{cloudflare:{env:{CDPHWIC:{},PRESCRIPTIONS:{},ENV:'dev'}}}};
  await expect(postCommand(event as never)).rejects.toMatchObject({statusCode:403});
 });
});
