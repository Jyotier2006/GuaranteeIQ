// GuaranteeIQ, model v2. All capacity losses are fractions, not percentages.
// Monthly stress-time model; repeated climatology, one persistent draw per project.
export const MODEL_VERSION = '2.0.0';
export const SEED = 42;
export const SAMPLE_COUNT = 2000;
export const CYCLE_CAP = 420 / 365;
export const MEAN_TEMP = [20.1,22.8,27.7,31.9,34.5,33.3,29.8,28.8,29.3,28.8,25.1,21.6];
export const MAX_TEMP = [27.9,31.0,35.8,39.7,41.8,39.0,33.7,32.3,33.6,35.6,33.1,29.5];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export type Scenario = 'Lab'|'Best'|'Base'|'Worst'|'Heatwave';
export const COLORS: Record<Scenario,string> = {Lab:'#c3c2b7',Best:'#3987e5',Base:'#c98500',Worst:'#e66767',Heatwave:'#f48f45'};
export interface Inputs {climate:'Ahmedabad'|'Lab';beta:number;cycles:number;soc:number;outages:number;guarantee:number;mwh:number;augCost:number;decline:number;discount:number;loading:number;eaCycle:number;cycleLife:number;kCal:number;eaCal:number;}
export const DEFAULTS:Inputs={climate:'Ahmedabad',beta:.4,cycles:1,soc:1.1,outages:0,guarantee:.75,mwh:500,augCost:1,decline:.04,discount:.1,loading:1.3,eaCycle:30000,cycleLife:8000,kCal:.018,eaCal:50000};
export const PRESETS:Record<Scenario,Partial<Inputs>>={Lab:{climate:'Lab',beta:0,cycles:1,soc:1,outages:0},Best:{climate:'Ahmedabad',beta:.15,cycles:.9,soc:1,outages:0},Base:{climate:'Ahmedabad',beta:.4,cycles:1,soc:1.1,outages:0},Worst:{climate:'Ahmedabad',beta:.7,cycles:1.15,soc:1.25,outages:0},Heatwave:{climate:'Ahmedabad',beta:.4,cycles:1,soc:1.1,outages:15}};
export const preset=(s:Scenario):Inputs=>({...DEFAULTS,...PRESETS[s]});
export function normalize(p:Inputs):Inputs { const limits:Record<string,[number,number]>={beta:[0,1],cycles:[.5,CYCLE_CAP],soc:[1,1.25],outages:[0,30],guarantee:[.6,.85],mwh:[1,10000],augCost:[.1,5],decline:[0,.1],discount:[0,.25],loading:[1,3],eaCycle:[0,40000],cycleLife:[6000,10000],kCal:[.01,.03],eaCal:[30000,70000]}; const result={...DEFAULTS,...p}; for(const [key,[low,high]] of Object.entries(limits)){const k=key as keyof Inputs; const v=Number(result[k]); (result as unknown as Record<string,unknown>)[key]=Number.isFinite(v)?Math.max(low,Math.min(high,v)):DEFAULTS[k];} result.climate=p.climate==='Lab'?'Lab':'Ahmedabad';return result;}
export function mulberry32(seed:number){let a=seed; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function normalGenerator(seed:number){const random=mulberry32(seed);let spare:number|null=null;return ()=>{if(spare!==null){const z=spare;spare=null;return z;}const u=1-random(),v=random();const r=Math.sqrt(-2*Math.log(u));spare=r*Math.sin(2*Math.PI*v);return r*Math.cos(2*Math.PI*v);};}
export function cellTemperature(p:Inputs,month:number,outage=false,offset=0){if(p.climate==='Lab')return 25;return outage?MAX_TEMP[month]+3+2*p.cycles+offset:25+2*p.cycles+p.beta*Math.max(MEAN_TEMP[month]+3+offset-25,0);}
const quantile=(sorted:number[],q:number)=>{const x=(sorted.length-1)*q,lo=Math.floor(x);return sorted[lo]+(sorted[Math.ceil(x)]-sorted[lo])*(x-lo);};
export interface CurvePoint {year:number;median:number;p10:number;p90:number;}
export interface Result {inputs:Inputs;n:number;seed:number;soh10:number;soh12:number;p10:number;p12:number;low10:number;high10:number;low12:number;high12:number;shortfall:number;expectedPV:number;premium:number;premiumPct:number;perKwh:number;reserve:number;curve:CurvePoint[];histogram:{value:number;count:number}[];samples10:number[];samples12:number[];}
// A terminal year-10 augmentation provision. This is not a complete tender warranty.
export function simulate(raw:Inputs,n=SAMPLE_COUNT,seed=SEED,withCurve=true,deterministic=false):Result {
 const p=normalize(raw),normal=normalGenerator(seed),size=deterministic?1:n;
 const paths: number[][]=withCurve?Array.from({length:145},()=>[]):[];
 const end10:number[]=[],end12:number[]=[],payouts:number[]=[];let shorts=0,miss10=0,miss12=0;
 const pvUnit=p.augCost*(1-p.decline)**10/(1+p.discount)**10;
 // Baseline calendar decomposition stays at 1.8% when its independent sensitivity changes.
 const cycleCoefficient=(.30-.018*Math.sqrt(4.4))/p.cycleLife;
 for(let i=0;i<size;i++){
  const z=Array.from({length:7},()=>deterministic?0:normal());
  const kCal=p.kCal*Math.exp(.15*z[0]),kCycle=cycleCoefficient*Math.exp(.15*z[1]);
  const eaCal=p.eaCal+7000*z[2];
  // Zero heat sensitivity means exactly zero, including parameter uncertainty.
  const eaCycle=p.eaCycle===0?0:p.eaCycle+6000*z[3];
  const beta=Math.max(0,Math.min(1,p.beta+.05*z[4]));
  const cycles=Math.max(0,Math.min(CYCLE_CAP,p.cycles*(1+.10*z[5]))),offset=z[6];
  const cal:number[]=[],cyc:number[]=[];
  for(let m=0;m<12;m++){
   const t=p.climate==='Lab'?25:25+2*cycles+beta*Math.max(MEAN_TEMP[m]+3+offset-25,0);
   const hot=MAX_TEMP[m]+3+2*cycles+offset;
   const fraction=p.climate==='Lab'?0:(m>=3&&m<=5?p.outages/3/30.4:0);
   const d=1/298.15-1/(t+273.15),dh=1/298.15-1/(hot+273.15);
   // Weight acceleration, not temperature, on cooling-outage days.
   const ac=(1-fraction)*Math.exp(eaCal/8.314*d)+fraction*Math.exp(eaCal/8.314*dh);
   const ay=(1-fraction)*Math.exp(eaCycle/8.314*d)+fraction*Math.exp(eaCycle/8.314*dh);
   cal.push(ac*p.soc/12);cyc.push(kCycle*ay*cycles*30.4);
  }
  let tau=0,cycleLoss=0,soh=1;if(withCurve)paths[0].push(1);
  for(let m=0;m<144;m++){
   tau+=cal[m%12];cycleLoss+=cyc[m%12];soh=1-kCal*Math.sqrt(tau)-cycleLoss;
   if(withCurve)paths[m+1].push(soh);
   if(m===119){end10.push(soh);miss10+=soh<p.guarantee?1:0;const short=Math.max(0,p.guarantee-soh)*p.mwh;shorts+=short;payouts.push(short*pvUnit);}
  }
  end12.push(soh);miss12+=soh<.70?1:0;
 }
 end10.sort((a,b)=>a-b);end12.sort((a,b)=>a-b);payouts.sort((a,b)=>a-b);
 const curve=paths.map((a,m)=>{a.sort((x,y)=>x-y);return {year:m/12,median:quantile(a,.5),p10:quantile(a,.1),p90:quantile(a,.9)};});
 const expectedPV=payouts.reduce((a,b)=>a+b,0)/size,premium=expectedPV*p.loading;
 const start=Math.floor(end10[0]*100/2)*2,stop=Math.ceil(end10[size-1]*100/2)*2;
 const histogram=Array.from({length:Math.max(1,(stop-start)/2)},(_,i)=>({value:start+i*2+1,count:0}));
 for(const s of end10){const index=Math.min(histogram.length-1,Math.floor((s*100-start)/2));histogram[Math.max(0,index)].count++;}
 return {inputs:p,n:size,seed,soh10:quantile(end10,.5),soh12:quantile(end12,.5),low10:quantile(end10,.1),high10:quantile(end10,.9),low12:quantile(end12,.1),high12:quantile(end12,.9),p10:miss10/size,p12:miss12/size,shortfall:shorts/size,expectedPV,premium,premiumPct:premium/(p.mwh*1.6)*100,perKwh:premium*1e7/(p.mwh*1000),reserve:quantile(payouts,.95),curve,histogram,samples10:end10,samples12:end12};
}
export interface RateCell {beta:number;cycles:number;premium:number;p:number;}
export function rateCard(p:Inputs,n=SAMPLE_COUNT){const cells:RateCell[]=[];for(let b=1;b<=8;b++)for(let c=0;c<8;c++){const beta=b/10,cycles=.8+c*.05;const r=simulate({...p,climate:'Ahmedabad',beta,cycles,soc:1.1,outages:0},n,SEED,false);cells.push({beta,cycles,premium:r.premium,p:r.p10});}return cells;}
export interface Sensitivity {label:string;low:number;high:number;lowValue:number;highValue:number;unit:string;}
export function sensitivity(){const specs:[string,keyof Inputs,number,number,string][]=[['Datasheet cycle life','cycleLife',10000,6000,'cycles'],['Average cycling','cycles',.9,1.15,'cycles/day'],['Calendar coefficient','kCal',.012,.024,'fraction/√year'],['Cycle heat sensitivity','eaCycle',0,40000,'J/mol'],['Ambient coupling β','beta',.25,.55,''],['High-charge resting','soc',1,1.25,'factor'],['Calendar activation','eaCal',40000,60000,'J/mol']];return specs.map(([label,key,lowValue,highValue,unit])=>({label,lowValue,highValue,unit,low:simulate({...DEFAULTS,[key]:lowValue},SAMPLE_COUNT,SEED,false).p10,high:simulate({...DEFAULTS,[key]:highValue},SAMPLE_COUNT,SEED,false).p10}));}
export interface Check {name:string;actual:number;target:number;tolerance:number;unit:string;pass:boolean;}
export function runQA(n=10000){const checks:Check[]=[];const check=(name:string,actual:number,target:number,tolerance:number,unit:string)=>checks.push({name,actual,target,tolerance,unit,pass:Math.abs(actual-target)<=tolerance});const names:Scenario[]=['Lab','Best','Base','Worst'];const sohs=[82.35,81.77,78.79,74.15],p10s=[.4,1,11.9,52.4],p12s=[.2,.6,8.6,44];const results:Result[]=[];
 names.forEach((name,i)=>{const input=preset(name),d=simulate(input,1,SEED,false,true),r=simulate(input,n,SEED,false);results.push(r);check(`${name}: deterministic SoH10`,100*d.soh10,sohs[i],.05,'%');check(`${name}: modeled P10`,100*r.p10,p10s[i],2,'%');check(`${name}: modeled P12`,100*r.p12,p12s[i],2,'%');});
 check('Base: premium',results[2].premium*100,34.7,3.47,'lakh');check('Worst: premium',results[3].premium*100,258,25.8,'lakh');check('Blended: premium',(results[1].premium*.25+results[2].premium*.5+results[3].premium*.25)*100,82,8.2,'lakh');
 for(const [days,prob,cost] of [[15,16.8,55],[30,22.8,83]]){const r=simulate({...DEFAULTS,outages:days},n,SEED,false);check(`${days} outage days: probability`,r.p10*100,prob,2,'%');check(`${days} outage days: premium`,r.premium*100,cost,cost*.1,'lakh');}
 for(const [beta,target] of [[.1,10],[.2,15],[.4,35],[.7,99]]){const r=simulate({...DEFAULTS,beta},n,SEED,false);check(`Rate card β=${beta}`,r.premium*100,target,target*.1,'lakh');}
 check('Worst: payout P95',results[3].reserve,8.1,.81,'crore');
 return {checks,passed:checks.every(x=>x.pass),n,seed:SEED,version:MODEL_VERSION,results};
}
