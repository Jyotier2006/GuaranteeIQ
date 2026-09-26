export const num=(x:number,d=1)=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d}).format(x);
export const money=(crore:number)=>crore>=1?`₹${num(crore,2)} crore`:`₹${num(crore*100,1)} lakh`;
export const pct=(fraction:number,d=1)=>`${num(fraction*100,d)}%`;
export function saveFile(name:string,content:string,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
