import {expect,it} from 'vitest';
import * as XLSX from 'xlsx';
import {productDb} from './helpers/productDb';
import {createProducts} from '../server/utils/productRepository';
import {activatePurchaseOrder,listPurchaseOrders,placePoOrder,updatePoOrder,parsePoWorkbook,previewPurchaseOrder} from '../server/utils/mckessonPo';
const product={productId:'001',productCode:'001',name:'Formula',form:'powder' as const,category:'standard' as const,unitsPerCase:6,mcKessonPo:'Yes',coverage:['wic' as const]};
async function fixture(){const {db,sqlite}=productDb();await createProducts(db,[product],{allowBlanks:true});sqlite.prepare('INSERT INTO surplus_submissions(id,agency_id,request_json,payload,actor_id) VALUES(?,?,?,?,?)').run('request-1',1,JSON.stringify({id:1,agencyId:1,productName:'Formula',productForm:'powder',formulaAuthorizations:[{productName:'Formula',productForm:'powder',productCode:'001'}]}),'test',1);return {db,sqlite};}
const input={number:'PO-1',startDate:'2027-01-01',endDate:'2027-06-30',allocations:[{productCode:'001',casesApproved:20,casesAlreadyUsed:2}]};
it('activates immutable allocations and adjusts balances through placement, editing, cancellation and retries',async()=>{const {db,sqlite}=await fixture();const po=await activatePurchaseOrder(db,input,1);const order={id:crypto.randomUUID(),requestId:1,productCode:'001',poId:po.id,cases:5,orderDate:'2027-01-01'};await placePoOrder(db,order,1);await placePoOrder(db,order,1);expect((await listPurchaseOrders(db))[0].allocations[0].casesRemaining).toBe(13);await updatePoOrder(db,order.id,{cases:7,status:'placed',version:0},1);expect((await listPurchaseOrders(db))[0].allocations[0].casesRemaining).toBe(11);await updatePoOrder(db,order.id,{cases:7,status:'cancelled',version:1},1);expect((await listPurchaseOrders(db))[0].allocations[0].casesRemaining).toBe(18);expect(sqlite.prepare('SELECT count(*) n FROM mckesson_po_order_audit').get()).toMatchObject({n:3});});
it('rejects invalid periods, duplicates, overdraws, wrong products and dates outside the PO',async()=>{const {db}=await fixture();await expect(activatePurchaseOrder(db,{...input,startDate:'2027-02-30'},1)).rejects.toThrow();await expect(previewPurchaseOrder(db,{...input,allocations:[...input.allocations,...input.allocations]})).rejects.toThrow('duplicate');const po=await activatePurchaseOrder(db,input,1);await expect(activatePurchaseOrder(db,input,1)).rejects.toThrow();const order={id:crypto.randomUUID(),requestId:1,productCode:'001',poId:po.id,cases:19,orderDate:'2027-01-01'};await expect(placePoOrder(db,order,1)).rejects.toThrow();await expect(placePoOrder(db,{...order,cases:1,orderDate:'2026-12-31'},1)).rejects.toThrow();expect((await listPurchaseOrders(db))[0].orders).toHaveLength(0);});
it('preserves formatted product numbers and requires explicit opening usage',()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Product Number','McKesson Price','Cases Approved','Cases Already Used'],['001',42.5,20,0]]),'PO');expect(parsePoWorkbook(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))).toEqual([{...input.allocations[0],casesAlreadyUsed:0,mcKessonPrice:42.5}]);expect(()=>parsePoWorkbook(new TextEncoder().encode('Product Number,Cases Approved,Cases Already Used\n001,20,\n'))).toThrow();});
it('uses SQL guards to prevent competing orders from overdrawing and rejects stale edits',async()=>{
 const {db}=await fixture();const po=await activatePurchaseOrder(db,input,1);
 const order={requestId:1,productCode:'001',poId:po.id,cases:10,orderDate:'2027-06-30'};
 const outcomes=await Promise.allSettled([placePoOrder(db,{...order,id:crypto.randomUUID()},1),placePoOrder(db,{...order,id:crypto.randomUUID()},2)]);
 expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
 const placed=(await listPurchaseOrders(db))[0].orders[0];
 await updatePoOrder(db,placed.id,{cases:9,status:'placed',version:0},1);
 await expect(updatePoOrder(db,placed.id,{cases:8,status:'placed',version:0},1)).rejects.toMatchObject({statusCode:409});
 expect((await listPurchaseOrders(db))[0].allocations[0].casesRemaining).toBe(9);
});
it('guards reviewer access before any PO read or mutation',async()=>{
 const {mckessonPoContext}=await import('../server/utils/mckessonPoContext');
 const {db}=await fixture();
 const event=(identity:string)=>({context:{cloudflare:{env:{CDPHWIC:db,PRESCRIPTIONS:{},ENV:'dev'}}},node:{req:{headers:{'x-demo-user':identity}}}} as never);
 expect(()=>mckessonPoContext(event('agency'))).toThrow('Only CDPH/WIC or Admin');
 expect(mckessonPoContext(event('admin')).db).toBe(db);
 expect(mckessonPoContext(event('internal')).db).toBe(db);
});
it('keeps old usage on its original PO after a new period activates',async()=>{
 const {db}=await fixture();const first=await activatePurchaseOrder(db,input,1);
 await placePoOrder(db,{id:crypto.randomUUID(),requestId:1,productCode:'001',poId:first.id,cases:5,orderDate:'2027-06-30'},1);
 const next=await activatePurchaseOrder(db,{...input,number:'PO-2',startDate:'2027-07-01',endDate:'2027-12-31',allocations:[{productCode:'001',casesApproved:100,casesAlreadyUsed:0}]},1);
 const pos=await listPurchaseOrders(db);
 expect(pos.find(p=>p.id===first.id)?.allocations[0].casesRemaining).toBe(13);
 expect(pos.find(p=>p.id===next.id)?.allocations[0].casesRemaining).toBe(100);
});
it('reads numeric case counts by value regardless of spreadsheet display formatting',()=>{
 const book=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([['Product Number','McKesson Price','Cases Approved','Cases Already Used'],['001',42.5,20,0]]);sheet.B2.z='0.00';sheet.D2.z='0.00';XLSX.utils.book_append_sheet(book,sheet,'PO');
 expect(parsePoWorkbook(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))).toEqual([{productCode:'001',casesApproved:20,casesAlreadyUsed:0,mcKessonPrice:42.5}]);
});
it('retains leading zeroes from formatted numeric Product Numbers',()=>{
 const book=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([['Product Number','McKesson Price','Cases Approved','Cases Already Used'],[1,42.5,20,0]]);sheet.A2.z='000';XLSX.utils.book_append_sheet(book,sheet,'PO');
 expect(parsePoWorkbook(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))[0].productCode).toBe('001');
});
it('returns a correction error for unreadable Excel data',()=>{
 expect(()=>parsePoWorkbook(new Uint8Array([0x50,0x4b,0x03,0x04,0xff]))).toThrow();
 try {parsePoWorkbook(new Uint8Array([0x50,0x4b,0x03,0x04,0xff]));}catch(error){expect(error).toMatchObject({statusCode:400});}
});
it('rejects invalid allocation batches without creating a partial PO',async()=>{
 const {db}=await fixture();
 await expect(activatePurchaseOrder(db,{...input,allocations:[...input.allocations,{productCode:'MISSING',casesApproved:4,casesAlreadyUsed:0}]},1)).rejects.toThrow('MISSING');
 await expect(activatePurchaseOrder(db,{...input,allocations:[{productCode:'001',casesApproved:4,casesAlreadyUsed:5}]},1)).rejects.toThrow();
 expect(await listPurchaseOrders(db)).toEqual([]);
});
it('retains the placed quantity in cancellation history and cannot reopen a cancelled order',async()=>{
 const {db}=await fixture();const po=await activatePurchaseOrder(db,input,1);
 const order=await placePoOrder(db,{id:crypto.randomUUID(),requestId:1,productCode:'001',poId:po.id,cases:5,orderDate:'2027-01-01'},1);
 await expect(updatePoOrder(db,order.id,{cases:2,status:'cancelled',version:0},1)).rejects.toThrow();
 await updatePoOrder(db,order.id,{cases:5,status:'cancelled',version:0},1);
 await expect(updatePoOrder(db,order.id,{cases:5,status:'placed',version:1},1)).rejects.toThrow();
 expect((await listPurchaseOrders(db))[0].orders[0]).toMatchObject({cases:5,status:'cancelled'});
});
it('accepts the Y/N McKesson flags used by the existing catalog',async()=>{
 const {db,sqlite}=await fixture();sqlite.prepare("UPDATE products SET mckesson_po='Y'").run();
 const po=await activatePurchaseOrder(db,input,1);
 await placePoOrder(db,{id:crypto.randomUUID(),requestId:1,productCode:'001',poId:po.id,cases:1,orderDate:'2027-01-01'},1);
 expect((await listPurchaseOrders(db))[0].allocations[0].casesRemaining).toBe(17);
});

it('accepts optional McKesson Price as dollars per case and rejects invalid prices',()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Product Number','McKesson Price','Cases Approved','Cases Already Used'],['001','$42.50',20,0]]),'PO');expect(parsePoWorkbook(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))[0].mcKessonPrice).toBe(42.5);const bad=XLSX.utils.book_new();XLSX.utils.book_append_sheet(bad,XLSX.utils.aoa_to_sheet([['Product Number','McKesson Price','Cases Approved','Cases Already Used'],['001','-1',20,0]]),'PO');expect(()=>parsePoWorkbook(XLSX.write(bad,{type:'buffer',bookType:'xlsx'}))).toThrow('McKesson Price');});
