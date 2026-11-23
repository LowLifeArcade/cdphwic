import {mckessonPoContext} from '../../utils/mckessonPoContext';
import {parsePoWorkbook,previewPurchaseOrder} from '../../utils/mckessonPo';
export default defineEventHandler(async event=>{
 const {db}=mckessonPoContext(event);const parts=await readMultipartFormData(event);const file=parts?.find(p=>p.name==='file');
 if(!file?.data)throw createError({statusCode:400,statusMessage:'Choose a CSV or Excel file.'});
 if(file.data.length>5*1024*1024)throw createError({statusCode:400,statusMessage:'Upload a spreadsheet smaller than 5 MB.'});
 const field=(name:string)=>parts?.find(p=>p.name===name)?.data.toString('utf8')??'';
 return {po:await previewPurchaseOrder(db,{number:field('number'),startDate:field('startDate'),endDate:field('endDate'),allocations:parsePoWorkbook(file.data)})};
});
