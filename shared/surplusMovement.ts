export function surplusMovementReason(value:unknown):string{
 if(typeof value!=='string'||!value)return '';
 try{
  const details=JSON.parse(value) as {reason?:string;staff?:string;date?:string}|null;
  if(!details||typeof details!=='object'||Array.isArray(details))return value;
  return [details.reason,details.staff?`Counted by ${details.staff}`:'',details.date?`Count date ${details.date}`:''].filter(Boolean).join(' · ')||value;
 }catch{return value;}
}
