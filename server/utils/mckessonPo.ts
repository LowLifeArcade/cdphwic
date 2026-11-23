import * as XLSX from 'xlsx';
import type {PoInput,PoAllocationInput,PoPreview,PurchaseOrder,PoOrderInput,PoOrder} from '../../shared/mckessonPo';
import {poDate,isMcKessonPo} from '../../shared/mckessonPo';
import {listProducts} from './productRepository';
import {candidateProducts} from '../../shared/productMatching';
import {requestFormulas} from '../../shared/requestPresentation';
import type {RequestRecord} from '../../shared/domain';

function fail(message:string,statusCode=400):never {throw Object.assign(new Error(message),{statusCode,statusMessage:message});}
const whole=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export function parsePoWorkbook(data:Uint8Array):PoAllocationInput[] {
 let workbook:XLSX.WorkBook;
 try {workbook=XLSX.read(data,{type:'array',raw:true});} catch {fail('Choose a valid CSV or Excel workbook.');}
 const sheet=workbook.Sheets[workbook.SheetNames[0]!];
 if(!sheet?.['!ref'])fail('The first worksheet is empty.');
 const range=XLSX.utils.decode_range(sheet['!ref']);const headers:string[]=[];
 for(let c=range.s.c;c<=range.e.c;c++)headers.push(String(sheet[XLSX.utils.encode_cell({r:range.s.r,c})]?.v??'').trim().toLowerCase());
 const required=['product number','cases approved','cases already used'];
 const priceHeader=headers.findIndex(h=>h==='mckesson price');
 for(const header of required)if(headers.filter(h=>h===header).length!==1)fail(`Include exactly one ${header} column.`);
 const rows:PoAllocationInput[]=[];
 for(let r=range.s.r+1;r<=range.e.r;r++){
  const values=required.map(header=>{const cell=sheet[XLSX.utils.encode_cell({r,c:range.s.c+headers.indexOf(header)})];return {cell,text:cell?.t==='n'?XLSX.utils.format_cell(cell).trim():String(cell?.v??'').trim()};});
  const priceCell=priceHeader<0?undefined:sheet[XLSX.utils.encode_cell({r,c:range.s.c+priceHeader})];
  if([...values.map(v=>v.text),priceCell?.v].every(v=>v===undefined||v===null||v===''))continue;
  if(values.some(v=>v.cell?.t==='e'))fail(`Row ${r+1}: Fix spreadsheet cell errors.`);
  const counts=values.slice(1).map(v=>{
   if(v.cell?.t==='n'){
    if(!whole(v.cell.v))fail(`Row ${r+1}: Case quantities must be whole, nonnegative numbers.`);
    return v.cell.v as number;
   }
   const token=v.text.replaceAll(',','');
   if(!/^\d+$/.test(token)||!whole(Number(token)))fail(`Row ${r+1}: Cases Approved and Cases Already Used require whole, nonnegative numbers (enter 0 when unused).`);
   return Number(token);
  });
  let mcKessonPrice:number|undefined;
  if(priceCell?.v!==undefined&&priceCell.v!==''){
   mcKessonPrice=typeof priceCell.v==='number'?priceCell.v:Number(String(priceCell.v).replace(/[$,]/g,'').trim());
   if(!Number.isFinite(mcKessonPrice)||mcKessonPrice<0)fail(`Row ${r+1}: McKesson Price must be a nonnegative dollar amount.`);
   mcKessonPrice=Math.round(mcKessonPrice*100)/100;
  }
  rows.push({productCode:values[0]!.text,casesApproved:counts[0]!,casesAlreadyUsed:counts[1]!,...(mcKessonPrice!==undefined?{mcKessonPrice}:{})});
 }
 if(!rows.length)fail('Add at least one product allocation.');return rows;
}
export async function previewPurchaseOrder(db:D1Database,input:PoInput):Promise<PoPreview> {
 if(!input||typeof input.number!=='string'||!input.number.trim()||input.number.trim().length>100)fail('Enter a PO number (100 characters or fewer).');
 if(!poDate(input.startDate)||!poDate(input.endDate)||input.endDate<input.startDate)fail('Enter valid PO start and end dates in chronological order.');
 if(!Array.isArray(input.allocations)||!input.allocations.length||input.allocations.length>1000)fail('Include between 1 and 1000 product allocations.');
 const products=await listProducts(db);const seen=new Set<string>();
 const allocations=input.allocations.map((row,index)=>{
  if(!row||typeof row.productCode!=='string'||!row.productCode.trim())fail(`Row ${index+2}: Enter a Product Number.`);
  const code=row.productCode.trim();if(seen.has(code))fail(`Row ${index+2}: duplicate Product Number ${code}.`);seen.add(code);
  const matches=products.filter(p=>p.productCode===code);if(matches.length!==1)fail(`Row ${index+2}: Product Number ${code} must match exactly one active catalog product.`);
  const product=matches[0]!;if(!isMcKessonPo(product.mcKessonPo))fail(`Row ${index+2}: ${code} is not marked Yes under McKesson PO.`);
  if(!whole(row.casesApproved)||!whole(row.casesAlreadyUsed)||row.casesAlreadyUsed>row.casesApproved)fail(`Row ${index+2}: Enter whole, nonnegative allocations and opening usage no greater than approved cases.`);
  const mcKessonPrice=row.mcKessonPrice??product.mcKessonPrice;
  return {productCode:code,productName:product.name,formulaDescription:product.formulaDescription,casesApproved:row.casesApproved,casesAlreadyUsed:row.casesAlreadyUsed,casesUsed:row.casesAlreadyUsed,casesRemaining:row.casesApproved-row.casesAlreadyUsed,...(mcKessonPrice!==undefined?{mcKessonPrice}:{})};
 });
 return {number:input.number.trim(),startDate:input.startDate,endDate:input.endDate,allocations};
}
export async function activatePurchaseOrder(db:D1Database,input:PoInput,actorId:number):Promise<PurchaseOrder> {
 const po=await previewPurchaseOrder(db,input);
 try {await db.batch([
  db.prepare('INSERT INTO mckesson_purchase_orders(number,start_date,end_date,created_by) VALUES(?,?,?,?)').bind(po.number,po.startDate,po.endDate,actorId),
  ...po.allocations.map(a=>db.prepare('INSERT INTO mckesson_po_allocations(po_id,product_code,product_name,formula_description,cases_approved,cases_already_used,mc_kesson_price) VALUES((SELECT id FROM mckesson_purchase_orders WHERE number=?),?,?,?,?,?,?)').bind(po.number,a.productCode,a.productName,a.formulaDescription??null,a.casesApproved,a.casesAlreadyUsed,a.mcKessonPrice??null)),
 ]);}catch(error){fail(`PO activation failed. The PO number may already exist; no allocations were saved.`,409);}
 return (await listPurchaseOrders(db)).find(p=>p.number===po.number)!;
}
export async function listPurchaseOrders(db:D1Database):Promise<PurchaseOrder[]> {
 const [pos,allocations,orders]=await Promise.all([
 db.prepare('SELECT id,number,start_date AS startDate,end_date AS endDate FROM mckesson_purchase_orders ORDER BY start_date DESC,id DESC').all<PurchaseOrder>(),
 db.prepare("SELECT a.po_id AS poId,a.product_code AS productCode,a.product_name AS productName,a.formula_description AS formulaDescription,a.cases_approved AS casesApproved,a.cases_already_used AS casesAlreadyUsed,a.mc_kesson_price AS mcKessonPrice,a.cases_already_used+COALESCE(SUM(CASE WHEN o.status='placed' THEN o.cases ELSE 0 END),0) AS casesUsed,a.cases_approved-a.cases_already_used-COALESCE(SUM(CASE WHEN o.status='placed' THEN o.cases ELSE 0 END),0) AS casesRemaining FROM mckesson_po_allocations a LEFT JOIN mckesson_po_orders o ON o.po_id=a.po_id AND o.product_code=a.product_code GROUP BY a.po_id,a.product_code ORDER BY a.product_name,a.product_code").all<PurchaseOrder['allocations'][number]&{poId:number}>(),
 db.prepare('SELECT id,po_id AS poId,request_id AS requestId,product_code AS productCode,cases,order_date AS orderDate,status,created_at AS createdAt,updated_at AS updatedAt,version FROM mckesson_po_orders ORDER BY created_at DESC,id').all<PoOrder>(),
 ]);
 return pos.results.map(po=>({...po,allocations:allocations.results.filter(a=>a.poId===po.id),orders:orders.results.filter(o=>o.poId===po.id)}));
}
async function existingOrder(db:D1Database,id:string){return db.prepare('SELECT id,po_id AS poId,request_id AS requestId,product_code AS productCode,cases,order_date AS orderDate,status,version FROM mckesson_po_orders WHERE id=?').bind(id).first<PoOrder>();}
export async function placePoOrder(db:D1Database,input:PoOrderInput,actorId:number):Promise<PoOrder> {
 if(!input||typeof input.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id))fail('A valid order operation ID is required.');
 if(!Number.isSafeInteger(input.poId)||input.poId<1||!Number.isSafeInteger(input.requestId)||input.requestId<1||typeof input.productCode!=='string'||!input.productCode.trim()||!whole(input.cases)||input.cases<1||!poDate(input.orderDate))fail('Select a PO, request, product, valid order date and positive whole case quantity.');
 const prior=await existingOrder(db,input.id);
 if(prior){if(['poId','requestId','productCode','cases','orderDate'].some(k=>prior[k as keyof PoOrder]!==input[k as keyof PoOrderInput]))fail('This operation ID already belongs to a different order.',409);return prior;}
 const requestRow=await db.prepare("SELECT request_json FROM surplus_submissions WHERE CAST(json_extract(request_json,'$.id') AS INTEGER)=?").bind(input.requestId).first<{request_json:string}>();
 if(!requestRow)fail('Request not found.',404);
 const request=JSON.parse(requestRow.request_json) as RequestRecord;
 const products=await listProducts(db);const product=products.find(p=>p.productCode===input.productCode);
 if(!product||!isMcKessonPo(product.mcKessonPo))fail('Choose an active McKesson PO product.');
 const associated=request.formulaAuthorizations?.some(a=>a.productCode===input.productCode)||requestFormulas(request).some(f=>candidateProducts([product],{name:f.otherFormulaName||f.productName,form:f.productForm}).length>0);
 if(!associated)fail('This product is not associated with the requested formulas.');
 const po=(await listPurchaseOrders(db)).find(p=>p.id===input.poId);
 if(!po||input.orderDate<po.startDate||input.orderDate>po.endDate)fail('Order date is outside this PO period.');
 if(!po.allocations.some(a=>a.productCode===input.productCode))fail('This product has no allocation on the selected PO.');
 try {await db.prepare("INSERT INTO mckesson_po_orders(id,po_id,product_code,request_id,cases,order_date,status,created_by,updated_by) VALUES(?,?,?,?,?,?,'placed',?,?)").bind(input.id,input.poId,input.productCode,input.requestId,input.cases,input.orderDate,actorId,actorId).run();}
 catch(error){const retry=await existingOrder(db,input.id);if(retry&&['poId','requestId','productCode','cases','orderDate'].every(k=>retry[k as keyof PoOrder]===input[k as keyof PoOrderInput]))return retry;fail('Unable to place order. Check the remaining PO balance and reload before trying again.',409);}
 return (await existingOrder(db,input.id))!;
}
export async function updatePoOrder(db:D1Database,id:string,input:{cases:number;status:'placed'|'cancelled';version?:number},actorId:number):Promise<PoOrder> {
 if(!input||!whole(input.cases)||input.cases<1||!['placed','cancelled'].includes(input.status))fail('Enter positive whole cases and a valid order status.');
 const previous=await existingOrder(db,id);if(!previous)fail('Order not found.',404);
 if(!whole(input.version)||input.version!==previous.version)fail('This order changed or its version is missing. Reload before editing it.',409);
 if((input.status==='cancelled'||previous.status==='cancelled')&&input.cases!==previous.cases)fail('Cancellation must retain the recorded order quantity. Save quantity changes separately.');
 if(previous.status==='cancelled'&&input.status!=='cancelled')fail('Cancelled orders cannot be reopened. Place a new order.');
 if(previous.status===input.status&&previous.cases===input.cases)return previous;
 try {const result=await db.prepare('UPDATE mckesson_po_orders SET cases=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?').bind(input.cases,input.status,actorId,id,previous.version).run();if(result.meta.changes!==1)fail('This order changed. Reload before editing it.',409);}
 catch(error){fail('Unable to update order. The remaining balance or order changed; reload before trying again.',409);}
 return (await existingOrder(db,id))!;
}
