import {expose} from 'comlink';
import {simulate,preset,rateCard,sensitivity,runQA,DEFAULTS,SEED,type Inputs,type Scenario} from './model';
const api={run:(p:Inputs)=>({site:simulate(p),lab:simulate({...p,...preset('Lab'),guarantee:p.guarantee,mwh:p.mwh,augCost:p.augCost,decline:p.decline,discount:p.discount,loading:p.loading,cycleLife:p.cycleLife,eaCycle:p.eaCycle,kCal:p.kCal,eaCal:p.eaCal})}),story:()=>({scenarios:(['Lab','Best','Base','Worst'] as Scenario[]).map(s=>({name:s,result:simulate(preset(s),10000)})),tornado:sensitivity()}),rate:(p:Inputs)=>rateCard(p),cooling:(p:Inputs)=>[.15,.4,.7].map(beta=>({beta,result:simulate({...p,climate:'Ahmedabad',beta},2000,SEED,false)})),qa:()=>runQA(10000),defaults:DEFAULTS};
expose(api);export type ModelWorker=typeof api;
