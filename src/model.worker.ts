import { expose } from "comlink";
import {
  simulate,
  preset,
  rateCard,
  sensitivity,
  runQA,
  DEFAULTS,
  SEED,
  type Inputs,
  type Result,
  type Scenario,
} from "./model";
// Every number shown uses 10,000 projects, matching the hero and QA references.
// The capacity-chart bands come from the first 2,000 of those same projects
// (same seed): sorting 145 monthly distributions of 10,000 would add ~0.5 s to
// each slider update without visibly changing the bands.
const PROJECTS = 10000,
  CURVE_PROJECTS = 2000;
const detailed = (p: Inputs): Result => ({
  ...simulate(p, PROJECTS, SEED, false),
  curve: simulate(p, CURVE_PROJECTS).curve,
});
const api = {
  run: (p: Inputs) => ({
    site: detailed(p),
    lab: detailed({
      ...p,
      ...preset("Lab"),
      guarantee: p.guarantee,
      mwh: p.mwh,
      augCost: p.augCost,
      decline: p.decline,
      discount: p.discount,
      loading: p.loading,
      cycleLife: p.cycleLife,
      eaCycle: p.eaCycle,
      kCal: p.kCal,
      eaCal: p.eaCal,
    }),
  }),
  story: () => ({
    scenarios: (["Lab", "Best", "Base", "Worst"] as Scenario[]).map((s) => ({
      name: s,
      result: simulate(preset(s), 10000),
    })),
    tornado: sensitivity(),
  }),
  rate: (p: Inputs) => rateCard(p, PROJECTS),
  cooling: (p: Inputs) =>
    [0.15, 0.4, 0.7].map((beta) => ({
      beta,
      result: simulate(
        { ...p, climate: "Ahmedabad", beta },
        PROJECTS,
        SEED,
        false,
      ),
    })),
  qa: () => runQA(10000),
  defaults: DEFAULTS,
};
expose(api);
export type ModelWorker = typeof api;
