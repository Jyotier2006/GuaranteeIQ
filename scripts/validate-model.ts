import {runQA,simulate,preset,SEED} from '../src/model.ts';
const qa=runQA();console.table(qa.checks);console.log(JSON.stringify({passed:qa.passed,n:qa.n,seed:qa.seed,version:qa.version}));
console.table(['Base','Worst','Heatwave'].map(s=>{const r=simulate(preset(s as 'Base'|'Worst'|'Heatwave'),2000,SEED,false);return {scenario:s,p:r.p10*100,premiumLakh:r.premium*100};}));
if(!qa.passed)process.exitCode=1;
