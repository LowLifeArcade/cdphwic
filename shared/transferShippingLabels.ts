export interface TransferShippingLabel {id:string;fileName:string;contentType:string;size:number;uploadedAt:string}
export function validateShippingLabel(data:Uint8Array,type:string):string{
 const valid=data.length>0&&data.length<=10*1024*1024&&(
  type==='application/pdf'&&new TextDecoder().decode(data.slice(0,5))==='%PDF-'||
  type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v)||
  type==='image/jpeg'&&data[0]===255&&data[1]===216&&data[2]===255);
 if(!valid)throw Object.assign(new Error('Choose a PDF, PNG, or JPEG shipping label of 10 MB or less.'),{statusCode:400,statusMessage:'Choose a PDF, PNG, or JPEG shipping label of 10 MB or less.'});
 return type;
}
