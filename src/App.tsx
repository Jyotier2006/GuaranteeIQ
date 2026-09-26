import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { wrap, type Remote } from "comlink";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  Sun,
  Moon,
  Download,
  Share2,
  ChevronDown,
  ChevronRight,
  Check,
  FlaskConical,
  Info,
  Wind,
  Thermometer,
  Activity,
  Database,
  Server,
  LockKeyhole,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Move,
  Radio,
  Menu,
  Monitor,
  Layers,
  CloudSun,
  HelpCircle,
} from "lucide-react";
import katex from "katex";
import {
  DEFAULTS,
  PRESETS,
  COLORS,
  MONTHS,
  MEAN_TEMP,
  CYCLE_CAP,
  MODEL_VERSION,
  normalize,
  preset,
  cellTemperature,
  type Inputs,
  type Result,
  type Scenario,
  type RateCell,
  type Sensitivity,
  type Check as QACheck,
} from "./model";
import type { ModelWorker } from "./model.worker";
import {
  Chart,
  capacityOption,
  histogramOption,
  rateOption,
  tornadoOption,
  exportChart,
} from "./charts";
import { Range, ControlGroup, Drawer } from "./ui";
import { num, money, pct, saveFile } from "./format";
import { registerModelTool } from "./webmcp";
import { ASSUMPTIONS, SOURCES } from "./evidence";
const HeroScene = lazy(() => import("./HeroScene"));
const scenarioNames: Scenario[] = ["Lab", "Best", "Base", "Worst", "Heatwave"];
const anchors = [
  "hero",
  "gap",
  "simulator",
  "rate-card",
  "cooling",
  "method",
  "contract",
  "implementation",
  "evidence",
];
const initial = () => {
  try {
    const p = new URLSearchParams(location.search).get("p");
    return p
      ? normalize({ ...DEFAULTS, ...JSON.parse(atob(p)) })
      : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
};
function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.55 }}
    >
      {children}
    </motion.div>
  );
}
function SectionTitle({
  number,
  kicker,
  title,
  description,
}: {
  number: string;
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <div className="eyebrow">
        <span>{number}</span>
        {kicker}
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
function Citation({ ids }: { ids: string[] }) {
  return (
    <span className="citations">
      {ids.map((s) => (
        <a key={s} href={`#source-${s}`}>
          {s}
        </a>
      ))}
    </span>
  );
}
function Equation({ tex }: { tex: string }) {
  return (
    <div
      className="equation"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          displayMode: true,
        }),
      }}
    />
  );
}
function CapacityLegend({ site = false }: { site?: boolean }) {
  return (
    <div className="chart-legend">
      {(site ? ["Lab", "This site"] : ["Lab", "Best", "Base", "Worst"]).map(
        (s) => (
          <span key={s}>
            <i
              style={{
                background: COLORS[s as Scenario] ?? "#14b8a6",
                opacity: s === "Lab" ? 0.6 : 1,
              }}
            />
            {s}
          </span>
        ),
      )}
      <small>Shaded area: P10–P90</small>
    </div>
  );
}
// The layer covers exactly the heatmap plot area (8 × 8 cells). The envelope
// spans 3 × 3 cells and snaps to them, so its label is the exact range covered.
const GRID_CELLS = 8,
  ENVELOPE_CELLS = 3;
function Envelope() {
  const [cell, setCell] = useState({ col: 3, row: 3 }); // top-left; row 0 = β 0.8
  const drag = useRef<{
    x: number;
    y: number;
    col: number;
    row: number;
  } | null>(null);
  const clamp = (v: number) =>
    Math.max(0, Math.min(GRID_CELLS - ENVELOPE_CELLS, v));
  const last = ENVELOPE_CELLS - 1,
    range = `β ${num(0.8 - (cell.row + last) * 0.1, 1)}–${num(0.8 - cell.row * 0.1, 1)} · ${num(0.8 + cell.col * 0.05, 2)}–${num(0.8 + (cell.col + last) * 0.05, 2)} cycles/day`,
    size = `${(ENVELOPE_CELLS / GRID_CELLS) * 100}%`;
  return (
    <div className="envelope-layer">
      <div
        className="envelope-box"
        style={{
          left: `${(cell.col / GRID_CELLS) * 100}%`,
          top: `${(cell.row / GRID_CELLS) * 100}%`,
          width: size,
          height: size,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ...cell };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = e.currentTarget.parentElement!.getBoundingClientRect();
          const d = drag.current;
          setCell({
            col: clamp(
              d.col + Math.round(((e.clientX - d.x) / rect.width) * GRID_CELLS),
            ),
            row: clamp(
              d.row +
                Math.round(((e.clientY - d.y) / rect.height) * GRID_CELLS),
            ),
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onKeyDown={(e) => {
          const d = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          }[e.key];
          if (d) {
            e.preventDefault();
            setCell((c) => ({
              col: clamp(c.col + d[0]),
              row: clamp(c.row + d[1]),
            }));
          }
        }}
        role="slider"
        aria-label="Proposed operating envelope; use arrow keys to move"
        aria-valuemin={0}
        aria-valuemax={GRID_CELLS - ENVELOPE_CELLS}
        aria-valuenow={cell.col}
        aria-valuetext={range}
        tabIndex={0}
      >
        <span className="envelope-tag">
          <Move size={11} /> PROPOSED ENVELOPE <b>{range}</b>
        </span>
      </div>
    </div>
  );
}
export default function App() {
  const [inputs, setInputs] = useState<Inputs>(initial),
    [selected, setSelected] = useState<Scenario | null>(() =>
      new URLSearchParams(location.search).has("p") ? null : "Base",
    );
  const [result, setResult] = useState<{ site: Result; lab: Result } | null>(
      null,
    ),
    [story, setStory] = useState<{
      scenarios: { name: Scenario; result: Result }[];
      tornado: Sensitivity[];
    } | null>(null);
  const [rates, setRates] = useState<RateCell[]>([]),
    [cooling, setCooling] = useState<{ beta: number; result: Result }[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [light, setLight] = useState(false),
    [drawer, setDrawer] = useState(false),
    [toast, setToast] = useState(""),
    [heroScenario, setHeroScenario] = useState<Scenario>("Base"),
    [month, setMonth] = useState(4),
    [sceneReady, setSceneReady] = useState(false);
  const [qaOpen, setQaOpen] = useState(location.hash === "#qa"),
    [qa, setQa] = useState<{
      checks: QACheck[];
      passed: boolean;
      n: number;
      seed: number;
      version: string;
    } | null>(null),
    [qaBusy, setQaBusy] = useState(false),
    [comparison, setComparison] = useState<{
      title: string;
      before: Result;
      after?: Result;
    } | null>(null);
  const worker = useRef<Worker | null>(null),
    api = useRef<Remote<ModelWorker> | null>(null),
    request = useRef(0),
    rateRequest = useRef(0),
    rateWorker = useRef<Worker | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const w = new Worker(new URL("./model.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    api.current = wrap<ModelWorker>(w);
    let active = true;
    api.current
      .story()
      .then((r) => {
        if (active) setStory(r);
      })
      .catch(() => {
        if (active)
          setError("The model could not initialize. Please reload the page.");
      });
    const timer = setTimeout(() => setSceneReady(true), 500);
    return () => {
      active = false;
      clearTimeout(timer);
      w.terminate();
    };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    setBusy(true);
    const timer = setTimeout(() => {
      api.current
        ?.run(inputs)
        .then((r) => {
          if (id !== request.current) return;
          setResult(r);
          setBusy(false);
          setComparison((c) => (c ? { ...c, after: r.site } : null));
        })
        .catch(() => {
          setBusy(false);
          setError("Calculation failed. Reset the inputs and try again.");
        });
      api.current?.cooling(inputs).then((c) => {
        if (id === request.current) setCooling(c);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [inputs]);
  // The 64-cell rate card runs 10,000 projects per cell (~2–3 s), so it gets
  // its own worker: it never delays the simulator, and a newer request
  // terminates an older one that is still computing.
  useEffect(() => () => rateWorker.current?.terminate(), []);
  useEffect(() => {
    const id = ++rateRequest.current;
    const timer = setTimeout(() => {
      rateWorker.current?.terminate();
      const w = new Worker(new URL("./model.worker.ts", import.meta.url), {
        type: "module",
      });
      rateWorker.current = w;
      wrap<ModelWorker>(w)
        .rate(inputs)
        .then((r) => {
          if (id === rateRequest.current) setRates(r);
        })
        .finally(() => {
          if (rateWorker.current === w) {
            w.terminate();
            rateWorker.current = null;
          }
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    inputs.guarantee,
    inputs.mwh,
    inputs.augCost,
    inputs.decline,
    inputs.discount,
    inputs.loading,
    inputs.eaCycle,
    inputs.cycleLife,
    inputs.kCal,
    inputs.eaCal,
  ]);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    document.documentElement.classList.toggle("projector", light);
  }, [light]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        ) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key.toLowerCase() === "p") setLight((x) => !x);
      const i = Number(e.key) - 1;
      if (i >= 0 && i < 9)
        document
          .getElementById(anchors[i])
          ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
    };
    const hash = () => setQaOpen(location.hash === "#qa");
    addEventListener("keydown", handler);
    addEventListener("hashchange", hash);
    return () => {
      removeEventListener("keydown", handler);
      removeEventListener("hashchange", hash);
    };
  }, [reduced]);
  useEffect(() => {
    if (!qaOpen || qa || qaBusy || !api.current) return;
    setQaBusy(true);
    api.current
      .qa()
      .then((r) => {
        setQa(r);
        setQaBusy(false);
      })
      .catch(() => {
        setError("Validation could not complete.");
        setQaBusy(false);
      });
  }, [qaOpen, qa, qaBusy]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  const inputRef = useRef(inputs);
  inputRef.current = inputs;
  useEffect(
    () =>
      registerModelTool(
        async (p) => {
          if (!api.current) throw new Error("Model is loading.");
          setInputs(p);
          setSelected(null);
          const r = await api.current.run(p);
          setResult(r);
          setBusy(false);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          return {
            inputs: p,
            probabilityYear10: r.site.p10,
            premiumCrore: r.site.premium,
            medianCapacityYear10: r.site.soh10,
            samples: r.site.n,
            qualification: "Modeled, conditional on stated assumptions",
          };
        },
        () => inputRef.current,
      ),
    [],
  );
  const change = (key: keyof Inputs, value: Inputs[keyof Inputs]) => {
    setSelected(null);
    setComparison(null);
    setInputs((p) => normalize({ ...p, [key]: value }));
  };
  const choose = (s: Scenario) => {
    setSelected(s);
    setComparison(null);
    setInputs((p) => ({ ...p, ...PRESETS[s] }));
  };
  const whatif = (title: string, patch: Partial<Inputs>) => {
    if (result) setComparison({ title, before: result.site });
    setSelected(null);
    setInputs((p) => normalize({ ...p, ...patch }));
  };
  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set("p", btoa(JSON.stringify(inputs)));
    url.hash = "simulator";
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url.href);
      setToast("Scenario link copied");
    } catch {
      setToast("Share this scenario using the address bar");
    }
  };
  const csv = () => {
    if (!result) return;
    const rows = [
      ["GuaranteeIQ", "Model " + MODEL_VERSION],
      ["Warning", "Modeled, conditional on stated assumptions"],
      ["Seed", 42],
      ["Simulations", result.site.n],
      ...Object.entries(inputs),
      ["P year 10", result.site.p10],
      ["P year 12", result.site.p12],
      ["Premium crore", result.site.premium],
      ["Premium capex percent", result.site.premiumPct],
      ["Premium INR per kWh", result.site.perKwh],
      ["P95 discounted payout crore", result.site.reserve],
      [],
      ["Year", "Median SoH", "P10 SoH", "P90 SoH"],
      ...result.site.curve.map((x) => [x.year, x.median, x.p10, x.p90]),
      [],
      ["Sources", ""],
      ...SOURCES.map((s) => [s.id, s.url]),
    ];
    saveFile(
      "GuaranteeIQ-results.csv",
      rows
        .map((r) =>
          r.map((c) => '"' + String(c).replaceAll('"', '""') + '"').join(","),
        )
        .join("\n"),
      "text/csv;charset=utf-8",
    );
  };
  const baseline = story?.scenarios[0].result;
  const blended = story
    ? story.scenarios[1].result.premium * 0.25 +
      story.scenarios[2].result.premium * 0.5 +
      story.scenarios[3].result.premium * 0.25
    : undefined;
  const sceneInput = preset(heroScenario),
    temp = cellTemperature(
      sceneInput,
      month,
      heroScenario === "Heatwave" && month >= 3 && month <= 5,
    );
  const sourceCaption = (
    <p className="source-caption">
      MODEL v{MODEL_VERSION} · Seed 42 · 10,000 projects · Team assumptions{" "}
      <Citation ids={["S1", "S2", "S3", "S4"]} />
    </p>
  );
  const siteOption = useMemo(
    () =>
      result
        ? capacityOption(
            [
              { name: "Lab", result: result.lab },
              { name: "This site", result: result.site, color: "#14b8a6" },
            ],
            inputs.guarantee,
            light,
          )
        : {},
    [result, inputs.guarantee, light],
  );
  return (
    <>
      <header className="header">
        <a className="wordmark" href="#hero">
          <span className="brand-icon">
            <ShieldCheck size={21} />
          </span>
          Guarantee<span>IQ</span>
          <span className="beta-badge">RESEARCH DEMO</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#gap">The gap</a>
          <a href="#simulator">Simulator</a>
          <a href="#method">Method</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <div className="nav-right">
          <button
            className="projector-button"
            onClick={() => setLight((v) => !v)}
            title="Projector mode · P"
            aria-label="Toggle projector mode"
          >
            {light ? <Moon size={17} /> : <Monitor size={17} />}
            <span>Projector</span>
            <kbd>P</kbd>
          </button>
          <a className="nav-cta" href="#simulator">
            Explore model <ArrowUpRight size={15} />
          </a>
        </div>
      </header>
      <main>
        <section id="hero" className="hero section-shell">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" /> BUILT FOR THE REAL WORLD
              </div>
              <h1>
                Battery guarantees
                <br />
                are priced at <em>25°C.</em>
                <br />
                <span className="quiet-heading">Gujarat runs hotter.</span>
              </h1>
              <p className="hero-description">
                Price a 10-year capacity guarantee for the site it will actually
                run at.
              </p>
              <p className="benchmark-note">
                An illustrative lab-only pricing benchmark. Actual OEM warranty
                practices vary.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#simulator">
                  Run the simulator <ArrowUpRight size={19} />
                </a>
                <a className="text-link" href="#method">
                  How it works <ArrowRight size={16} />
                </a>
              </div>
              <div className="hero-proof">
                <span>
                  <CheckCircle2 size={14} /> Transparent assumptions
                </span>
                <span>
                  <CheckCircle2 size={14} /> Runs in your browser
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="scene-topline">
                <span>
                  <span className="live-dot" /> AHMEDABAD, GUJARAT
                </span>
                <span className="scene-coordinate">
                  INDIAN OPERATING CONDITIONS
                </span>
              </div>
              <div
                className="scene-wrap"
                aria-label="Interactive 40-foot battery container thermal illustration"
              >
                {sceneReady ? (
                  <Suspense
                    fallback={
                      <div className="scene-fallback">
                        <Layers size={80} />
                        <span>Loading the battery system…</span>
                      </div>
                    }
                  >
                    <HeroScene
                      month={month}
                      scenario={heroScenario}
                      temperature={temp}
                      beta={sceneInput.beta}
                      reduced={!!reduced}
                      light={light}
                    />
                  </Suspense>
                ) : (
                  <div className="scene-fallback">
                    <Layers size={80} />
                    <span>Battery thermal view</span>
                  </div>
                )}
                <div className="thermal-tag">
                  <Thermometer size={15} />
                  <span>MODELED CELL</span>
                  <strong>{num(temp, 1)}°C</strong>
                </div>
                <div className="scene-caption">
                  <span>40-ft container · illustrative geometry</span>
                  <span>
                    Drag to explore <Move size={11} />
                  </span>
                </div>
              </div>
              <div className="scene-controls">
                <div
                  className="scenario-tabs small"
                  role="group"
                  aria-label="Hero scenario"
                >
                  {scenarioNames.map((s) => (
                    <button
                      key={s}
                      className={heroScenario === s ? "active" : ""}
                      onClick={() => setHeroScenario(s)}
                    >
                      <i style={{ background: COLORS[s] }} />
                      {s}
                    </button>
                  ))}
                </div>
                <div className="month-control">
                  <Sun size={16} />
                  <input
                    aria-label="Month"
                    type="range"
                    min={0}
                    max={11}
                    step={1}
                    value={month}
                    onChange={(e) => setMonth(+e.target.value)}
                  />
                  <output>{MONTHS[month]}</output>
                  <span className="ambient-text">
                    {num(MEAN_TEMP[month], 1)}°C ambient
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-bottom">
            <div className="hero-counter muted">
              <span>ILLUSTRATIVE LAB-ONLY PREMIUM</span>
              <strong>
                {baseline ? money(baseline.premium) : "Calculating…"}
              </strong>
            </div>
            <div className="counter-arrow">
              <ArrowRight size={27} />
            </div>
            <div className="hero-counter">
              <span>GUJARAT SCENARIO MIX · 25 / 50 / 25</span>
              <strong>
                {blended !== undefined ? money(blended) : "Calculating…"}
                <small>/ project</small>
              </strong>
            </div>
            <div className="reference-project">
              <span>REFERENCE PROJECT</span>
              <strong>
                125 MW <i>/</i> 500 MWh
              </strong>
              <small>4-hour LFP · hypothetical Gujarat site</small>
            </div>
          </div>
          <p className="hero-model-note">
            Modeled estimates, conditional on stated assumptions · 10,000
            projects per scenario · year-10 augmentation only.
          </p>
          <a className="scroll-hint" href="#gap">
            <ArrowDown size={13} /> FOLLOW THE RISK
          </a>
        </section>
        <section id="gap" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="01"
              kicker="THE GUARANTEE GAP"
              title="The promise stays fixed. The battery doesn't."
              description="The same chemistry. Different conditions. Twelve years of consequences."
            />
            <div className="panel gap-panel">
              <div className="panel-topline">
                <span>USABLE CAPACITY OVER TIME</span>
                <span className="tag">P10–P90 uncertainty bands</span>
              </div>
              <CapacityLegend />
              {story ? (
                <Chart
                  option={capacityOption(story.scenarios, 0.75, light)}
                  height={385}
                  label="Lab, Best, Base and Worst capacity trajectories with uncertainty bands"
                />
              ) : (
                <div className="chart-loading">
                  Calculating four operating scenarios…
                </div>
              )}
              {sourceCaption}
            </div>
          </Reveal>
          <div className="gap-captions">
            {[
              {
                n: "01",
                title: "Start with the datasheet.",
                body: "A controlled 25°C benchmark produces a reassuring capacity curve.",
              },
              {
                n: "02",
                title: "Let the site into the model.",
                body: "Ambient heat, cooling quality, high-charge resting and cycling shift the outcome.",
              },
              {
                n: "03",
                title: "Price the promise you make.",
                body: "Translate the shortfall distribution into a year-10 augmentation provision.",
              },
            ].map((c) => (
              <Reveal key={c.n}>
                <span className="step-num">{c.n}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </Reveal>
            ))}
          </div>
          <div className="gap-stat-band">
            <span>MODELED YEAR-10 SHORTFALL</span>
            {story?.scenarios
              .filter((s) => s.name !== "Best")
              .map((s) => (
                <div key={s.name}>
                  <strong style={{ color: COLORS[s.name] }}>
                    {pct(s.result.p10)}
                  </strong>
                  <small>
                    {s.name === "Lab"
                      ? "Lab-only benchmark"
                      : s.name === "Base"
                        ? "Base operating case"
                        : "Poor-cooling scenario"}
                  </small>
                </div>
              ))}
          </div>
        </section>
        <section id="simulator" className="section-shell section-pad">
          <SectionTitle
            number="02"
            kicker="THE LIVE SIMULATOR"
            title="Your site. Your assumptions. Your premium."
            description="Move a slider. Ask a harder question. Every number recalculates locally."
          />
          <div className="simulator-toolbar">
            <div
              className="scenario-tabs"
              role="group"
              aria-label="Simulator presets"
            >
              {scenarioNames.map((s) => (
                <button
                  key={s}
                  className={selected === s ? "active" : ""}
                  onClick={() => choose(s)}
                >
                  <i style={{ background: COLORS[s] }} />
                  {s}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setInputs({ ...DEFAULTS });
                setSelected("Base");
                setComparison(null);
              }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
          <div className="simulator-grid">
            <aside className="panel controls">
              <div className="controls-title">
                <SlidersHorizontal size={16} /> SITE CONFIGURATION{" "}
                <span className="tag">LIVE</span>
              </div>
              <ControlGroup title="Site & operations" initial>
                <label className="select-control">
                  Climate
                  <select
                    value={inputs.climate}
                    onChange={(e) =>
                      change("climate", e.target.value as Inputs["climate"])
                    }
                  >
                    <option value="Ahmedabad">
                      Ahmedabad · IMD-based normals
                    </option>
                    <option value="Lab">Lab · fixed 25°C</option>
                  </select>
                </label>
                <Range
                  label="Ambient coupling β"
                  value={inputs.beta}
                  min={0}
                  max={1}
                  onChange={(v) => change("beta", v)}
                  format={(v) => num(v, 2)}
                  note="Ambient-temperature coupling coefficient; illustrative cooling proxy"
                />
                <Range
                  label="Average cycles / day"
                  value={inputs.cycles}
                  min={0.5}
                  max={CYCLE_CAP}
                  step={0.01}
                  onChange={(v) => change("cycles", v)}
                  format={(v) => num(v, 2)}
                  note="SECI cap: 420 cycles/year · model EFC proxy"
                />
                <label className="select-control">
                  High-charge resting
                  <select
                    value={inputs.soc}
                    onChange={(e) => change("soc", +e.target.value)}
                  >
                    <option value={1}>Low · factor 1.00</option>
                    <option value={1.1}>Medium · factor 1.10</option>
                    <option value={1.25}>High · factor 1.25</option>
                  </select>
                </label>
                <Range
                  label="HVAC outage days / year"
                  value={inputs.outages}
                  min={0}
                  max={30}
                  step={1}
                  onChange={(v) => change("outages", v)}
                  format={(v) => `${v} days`}
                  note="Split evenly across April, May and June"
                />
                {inputs.climate === "Lab" && (
                  <p className="control-note">
                    Lab fixes cell temperature at 25°C; β and outage settings
                    have no thermal effect.
                  </p>
                )}
              </ControlGroup>
              <ControlGroup title="Contract">
                <Range
                  label="Year-10 capacity guarantee"
                  value={inputs.guarantee}
                  min={0.6}
                  max={0.85}
                  step={0.01}
                  onChange={(v) => change("guarantee", v)}
                  format={(v) => pct(v, 0)}
                />
                <label className="number-control">
                  Initial usable capacity (MWh)
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={inputs.mwh}
                    onChange={(e) => change("mwh", +e.target.value)}
                  />
                </label>
                <p className="control-note">
                  Year 12 is tested separately against 70%. The premium covers
                  the year-10 test only.
                </p>
              </ControlGroup>
              <ControlGroup title="Finance">
                <Range
                  label="Augmentation (₹ crore / MWh)"
                  value={inputs.augCost}
                  min={0.1}
                  max={2}
                  step={0.05}
                  onChange={(v) => change("augCost", v)}
                  format={(v) => num(v, 2)}
                />
                <Range
                  label="Annual cost decline"
                  value={inputs.decline}
                  min={0}
                  max={0.1}
                  step={0.005}
                  onChange={(v) => change("decline", v)}
                  format={(v) => pct(v, 1)}
                />
                <Range
                  label="Discount rate"
                  value={inputs.discount}
                  min={0}
                  max={0.2}
                  step={0.005}
                  onChange={(v) => change("discount", v)}
                  format={(v) => pct(v, 1)}
                />
                <Range
                  label="Risk / capital / admin loading"
                  value={inputs.loading}
                  min={1}
                  max={2}
                  step={0.05}
                  onChange={(v) => change("loading", v)}
                  format={(v) => `${num(v, 2)}×`}
                />
              </ControlGroup>
              <ControlGroup title="Model uncertainty">
                <Range
                  label="Cycle heat sensitivity"
                  value={inputs.eaCycle}
                  min={0}
                  max={40000}
                  step={1000}
                  onChange={(v) => change("eaCycle", v)}
                  format={(v) => `${num(v / 1000, 0)} kJ/mol`}
                />
                <Range
                  label="Datasheet cycle life"
                  value={inputs.cycleLife}
                  min={6000}
                  max={10000}
                  step={250}
                  onChange={(v) => change("cycleLife", v)}
                  format={(v) => num(v, 0)}
                />
                <p className="control-note">
                  One persistent set of parameter draws per project. 10,000
                  projects · seed 42.
                </p>
              </ControlGroup>
            </aside>
            <div className="simulator-results" aria-busy={busy}>
              <div className="result-status">
                <span>
                  <span
                    className={busy ? "live-dot calculating" : "live-dot"}
                  />
                  {busy ? "Updating model…" : "MODEL UPDATED"}
                </span>
                <button className="text-button" onClick={() => setDrawer(true)}>
                  <HelpCircle size={15} />
                  Judge questions <ChevronRight size={14} />
                </button>
              </div>
              {error && (
                <div role="alert" className="error-message">
                  {error}
                </div>
              )}
              <div className="kpi-grid">
                <div className="kpi panel">
                  <span>CHANCE OF MISSING YEAR 10</span>
                  <strong className="risk-number">
                    {result ? pct(result.site.p10) : "—"}
                  </strong>
                  <small>
                    Below {pct(inputs.guarantee, 0)} usable capacity
                  </small>
                </div>
                <div className="kpi panel">
                  <span>YEAR-10 MEDIAN CAPACITY</span>
                  <strong>{result ? pct(result.site.soh10) : "—"}</strong>
                  <small>
                    {result
                      ? `${num(result.site.low10 * 100, 1)}–${num(result.site.high10 * 100, 1)}% · P10–P90`
                      : "Calculating uncertainty"}
                  </small>
                </div>
                <div className="kpi premium-kpi panel">
                  <span>RECOMMENDED UPFRONT PREMIUM</span>
                  <strong>{result ? money(result.site.premium) : "—"}</strong>
                  <small>
                    {result
                      ? `${num(result.site.premiumPct, 3)}% of capex · ₹${num(result.site.perKwh, 1)}/kWh`
                      : "Year-10 augmentation provision"}
                  </small>
                </div>
              </div>
              <div className="secondary-kpis">
                <div>
                  <span>YEAR 12 · BELOW 70%</span>
                  <strong>{result ? pct(result.site.p12) : "—"}</strong>
                </div>
                <div>
                  <span>EXPECTED SHORTFALL</span>
                  <strong>
                    {result ? num(result.site.shortfall, 2) : "—"}{" "}
                    <small>MWh</small>
                  </strong>
                </div>
                <div>
                  <span>
                    P95 DISCOUNTED PAYOUT <Info size={12} />
                  </span>
                  <strong>{result ? money(result.site.reserve) : "—"}</strong>
                  <small>Illustrative reserve proxy</small>
                </div>
              </div>
              {comparison?.after && (
                <div className="whatif-comparison">
                  <strong>{comparison.title}</strong>
                  <span>
                    Shortfall probability: {pct(comparison.before.p10)} →{" "}
                    {pct(comparison.after.p10)}
                  </span>
                  <span>
                    Premium: {money(comparison.before.premium)} →{" "}
                    {money(comparison.after.premium)}
                  </span>
                </div>
              )}
              <div className="panel simulator-chart">
                <div className="panel-topline">
                  <span>CAPACITY AT RISK</span>
                  <CapacityLegend site />
                </div>
                {result && (
                  <Chart
                    option={siteOption}
                    id="sim-capacity-chart"
                    height={280}
                    label="Selected site capacity against the lab-only benchmark"
                  />
                )}
              </div>
              <div className="sim-small-charts">
                <div className="panel">
                  <div className="panel-topline">
                    <span>YEAR-10 OUTCOMES</span>
                  </div>
                  {result && (
                    <Chart
                      option={histogramOption(result.site, light)}
                      height={230}
                      label="Distribution of year-10 usable capacity"
                    />
                  )}
                </div>
                <div className="panel mispricing">
                  <div className="panel-topline">
                    <span>PRICING BENCHMARK GAP</span>
                  </div>
                  {result && (
                    <>
                      <div className="pricing-row">
                        <span>Lab-only</span>
                        <strong>{money(result.lab.premium)}</strong>
                      </div>
                      <div className="price-track">
                        <span
                          style={{
                            width: `${Math.max(1, (result.lab.premium / Math.max(result.site.premium, result.lab.premium, 0.001)) * 100)}%`,
                            background: COLORS.Lab,
                          }}
                        />
                      </div>
                      <div className="pricing-row">
                        <span>This site</span>
                        <strong>{money(result.site.premium)}</strong>
                      </div>
                      <div className="price-track">
                        <span
                          style={{
                            width: `${Math.max(1, (result.site.premium / Math.max(result.site.premium, result.lab.premium, 0.001)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p>
                        The difference reflects this model's assumptions, not an
                        observed market pricing error.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <p className="model-disclaimer">
                <Info size={14} /> Modeled probabilities, conditional on the
                stated assumptions.
              </p>
              <div className="export-row">
                <button className="text-button" onClick={share}>
                  <Share2 size={14} />
                  Share scenario
                </button>
                <button className="text-button" onClick={csv}>
                  <Download size={14} />
                  Results CSV
                </button>
                <button
                  className="text-button"
                  onClick={() => exportChart("sim-capacity-chart")}
                >
                  <Download size={14} />
                  Chart PNG
                </button>
                <span>All calculations stay in your browser.</span>
              </div>
            </div>
          </div>
        </section>
        <section id="rate-card" className="section-shell section-pad">
          <Reveal>
            <div className="split-heading">
              <SectionTitle
                number="03"
                kicker="THE USAGE-INDEXED RATE CARD"
                title="Run cooler. Price the promise better."
                description="Explore a fixed operating envelope before signing. Click a cell to load that site."
              />
              <div className="rate-unit">
                <span>PREMIUM IN</span>
                <strong>₹ lakh</strong>
                <small>Year 10 · {pct(inputs.guarantee, 0)} guarantee</small>
              </div>
            </div>
            <div className="panel rate-panel">
              <div className="rate-chart-wrap">
                {rates.length > 0 ? (
                  <Chart
                    option={rateOption(rates, light)}
                    height={465}
                    label="Premium heatmap across ambient coupling and average daily cycles"
                    onClick={(data) => {
                      const a = data as number[];
                      const cell = rates[a[3]];
                      if (cell) {
                        setInputs((p) => ({
                          ...p,
                          climate: "Ahmedabad",
                          beta: cell.beta,
                          cycles: cell.cycles,
                          soc: 1.1,
                          outages: 0,
                        }));
                        setSelected(null);
                        document
                          .getElementById("simulator")
                          ?.scrollIntoView({
                            behavior: reduced ? "instant" : "smooth",
                          });
                      }
                    }}
                  />
                ) : (
                  <div className="chart-loading">
                    Calculating the rate card…
                  </div>
                )}
                <Envelope />
              </div>
              <div className="rate-footnote">
                <LockKeyhole size={18} />
                <p>
                  <strong>
                    Fixed envelope at signing + pre-agreed, capped adjustment
                    schedule.
                  </strong>
                  <br />
                  No open-ended repricing. The draggable box is a proposed
                  contract envelope, not a fitted risk boundary.
                </p>
                <span>
                  Lower cost <i className="heat-gradient" /> Higher cost
                </span>
              </div>
              <p className="source-caption">
                Ahmedabad · high-charge factor 1.10 · no outages · current
                contract and finance inputs. Cell labels are ₹ lakh.
              </p>
            </div>
          </Reveal>
        </section>
        <section id="cooling" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="04"
              kicker="COOLING IS A FINANCIAL DECISION"
              title="What is better cooling worth?"
              description="Same dispatch. Same contract. Change only the site's ambient-temperature coupling."
            />
            <div className="cooling-grid">
              {cooling.map((c, i) => (
                <div
                  className={`panel cooling-card ${i === 0 ? "featured" : ""}`}
                  key={c.beta}
                >
                  <div className="cooling-icon">
                    <Wind size={23} />
                  </div>
                  <span>
                    {["BETTER COUPLING", "BASE COUPLING", "POOR COUPLING"][i]}
                  </span>
                  <h3>β {num(c.beta, 2)}</h3>
                  <strong>{money(c.result.premium)}</strong>
                  <small>
                    Recommended premium · {num(inputs.cycles, 2)} cycles/day
                  </small>
                  <div className="cooling-bar">
                    <i
                      style={{
                        width: `${Math.min(100, c.result.p10 * 100)}%`,
                        background:
                          COLORS[["Best", "Base", "Worst"][i] as Scenario],
                      }}
                    />
                  </div>
                  <p>{pct(c.result.p10)} modeled chance of shortfall</p>
                </div>
              ))}
            </div>
            <div className="decision-note">
              <Zap size={20} />
              <p>
                {cooling.length === 3 ? (
                  <>
                    <strong>
                      {money(
                        cooling[2].result.premium - cooling[0].result.premium,
                      )}{" "}
                      difference in modeled premium.
                    </strong>{" "}
                    Compare it with incremental cooling capex, electricity, and
                    maintenance over the same present-value horizon.
                  </>
                ) : (
                  "Compare the modeled premium reduction with additional HVAC expenditure."
                )}
              </p>
              <a href="#sources">
                See assumptions <ArrowUpRight size={15} />
              </a>
            </div>
          </Reveal>
        </section>
        <section id="method" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="05"
              kicker="OPEN THE MODEL"
              title="No black box. Follow every rupee."
              description="Five steps connect the weather outside to the promise on the contract."
            />
            <div className="method-grid">
              {[
                {
                  icon: CloudSun,
                  name: "Site weather",
                  copy: "Monthly Ahmedabad climate, plus a persistent site offset.",
                  eq: "T_{a,eff}=T_{a,month}+3+\\Delta T_{site}",
                },
                {
                  icon: Thermometer,
                  name: "Cell temperature",
                  copy: "A simple exposure proxy for cooling and average use.",
                  eq: "T_c=25+2n+\\beta\\max(T_{a,eff}-25,0)",
                },
                {
                  icon: Activity,
                  name: "Capacity aging",
                  copy: "Calendar stress accumulates; cycles add throughput loss.",
                  eq: "SoH=1-k_{cal}\\sqrt{\\tau}-Q_{cyc}",
                },
                {
                  icon: Layers,
                  name: "Uncertainty",
                  copy: "One persistent draw per simulated project, repeated over 144 months.",
                  eq: "P_{10}=\\frac{1}{N}\\sum_i \\mathbf{1}(SoH_{i,10}<G)",
                },
                {
                  icon: ShieldCheck,
                  name: "Price the guarantee",
                  copy: "Reference project equation below; the simulator uses your selected size and loading.",
                  eq: "\\Pi=1.3\\,\\mathbb{E}\\!\\left[\\frac{500\\max(0,G-SoH_{10})C_0(1-d)^{10}}{(1+r)^{10}}\\right]",
                },
              ].map((step, i) => (
                <details className="method-step" key={step.name}>
                  <summary>
                    <span className="method-icon">
                      <step.icon size={25} />
                    </span>
                    <span className="step-num">0{i + 1}</span>
                    <h3>{step.name}</h3>
                    <p>{step.copy}</p>
                    <span className="expand-label">
                      See equation <ChevronDown size={13} />
                    </span>
                  </summary>
                  <Equation tex={step.eq} />
                </details>
              ))}
            </div>
            <div className="method-details panel">
              <div>
                <h3>The temperature detail that matters.</h3>
                <Equation
                  tex={
                    "AF=\\exp\\!\\left[\\frac{E_a}{R}\\left(\\frac{1}{298.15}-\\frac{1}{T_c+273.15}\\right)\\right]"
                  }
                />
                <p>
                  For calendar aging, +10°C around 25°C makes stress-time
                  accumulate about <strong>1.9× faster</strong> and produces
                  about <strong>1.4× more calendar loss</strong> at the same
                  age. The acceleration sits inside √τ.
                </p>
              </div>
              <div>
                <h3>A calibration, with clear limits.</h3>
                <p>
                  Calendar/cycle split is an assumed decomposition anchored to a
                  manufacturer's published cycle-life endpoint—an illustrative
                  calibration, not a validated cell model.
                </p>
                <Equation
                  tex={"k_{cyc}=\\frac{0.30-0.018\\sqrt{4.4}}{N_{life}}"}
                />
                <p>
                  On outage days, mean daily maximum temperature is used as a
                  stress proxy. We weight acceleration factors by outage-day
                  share, not average the two temperatures.{" "}
                  <Citation ids={["S3", "S4", "S5"]} />
                </p>
              </div>
            </div>
          </Reveal>
        </section>
        <section id="contract" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="06"
              kicker="DEFINE THE PROMISE"
              title="A useful price starts with a precise contract."
            />
            <div className="contract-grid">
              <div className="panel contract-table">
                {[
                  [
                    "Initial capacity",
                    "500 MWh usable at COD under a defined capacity test.",
                  ],
                  [
                    "Measurement boundary",
                    "DC usable-energy proxy in this model. The cited SECI tender measures dispatchable capacity at the AC metering point; no AC/DC loss bridge is modeled.",
                  ],
                  [
                    "Coverage",
                    "Shortfall below the selected threshold at the year-10 test; 75% by default.",
                  ],
                  ["Remedy", "Augmentation to restore the year-10 threshold."],
                  [
                    "Outside this calculation",
                    "PCS and auxiliary losses, downtime, availability damages, earlier annual tests, and other warranty events.",
                  ],
                  [
                    "Year 12",
                    "Projected separately and tested against 70%; not included in the year-10 premium.",
                  ],
                ].map(([a, b]) => (
                  <div key={a}>
                    <strong>{a}</strong>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="contract-callout">
                <span className="eyebrow">CAPACITY ≠ DURATION</span>
                <strong>
                  75% <span>of 500 MWh</span>
                </strong>
                <div className="big-equals">
                  = 375 MWh
                  <br />= 3 hours
                </div>
                <p>
                  At 125 MW, before additional losses. A capacity-retention
                  guarantee does not preserve the original four-hour discharge
                  duration.
                </p>
                <Citation ids={["S1"]} />
              </div>
            </div>
            <p className="source-caption">
              SECI/GRIDCO is an Odisha tender. Its thresholds inform this
              hypothetical Gujarat case; this demo is not a complete
              tender-compliance assessment.
            </p>
          </Reveal>
        </section>
        <section id="implementation" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="07"
              kicker="BUILT AROUND WHAT ALREADY EXISTS"
              title="The data is already in the battery system."
              description="Connect existing records. Make the guarantee auditable. No new battery hardware is required by the concept."
            />
            <div className="implementation-flow panel">
              <div className="equipment-nodes">
                {[
                  {
                    icon: Thermometer,
                    title: "BMS",
                    sub: "Cell temperature · voltage · current · SoC",
                  },
                  {
                    icon: Wind,
                    title: "HVAC",
                    sub: "Operating status · faults · maintenance",
                  },
                  {
                    icon: Activity,
                    title: "EMS",
                    sub: "Dispatch · charge / discharge throughput",
                  },
                  {
                    icon: Radio,
                    title: "Data gateway",
                    sub: "Timestamped, read-only data collection",
                  },
                  {
                    icon: CheckCircle2,
                    title: "Capacity tests",
                    sub: "Periodic standardized measurements",
                  },
                ].map((x) => (
                  <div className="equipment-node" key={x.title}>
                    <x.icon size={19} />
                    <div>
                      <strong>{x.title}</strong>
                      <small>{x.sub}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flow-link">
                <ArrowRight size={25} />
              </div>
              <div className="engine-node">
                <ShieldCheck size={38} />
                <h3>GuaranteeIQ</h3>
                <p>Exposure → degradation → provision</p>
                <span className="tag">AUDITABLE MODEL</span>
              </div>
              <div className="flow-link">
                <ArrowRight size={25} />
              </div>
              <div className="output-nodes">
                <div>
                  <SlidersHorizontal size={22} />
                  <strong>Operating envelope</strong>
                  <small>Pre-agreed, capped adjustments</small>
                </div>
                <div>
                  <RotateCcw size={22} />
                  <strong>Annual recalibration</strong>
                  <small>Updated evidence, agreed terms</small>
                </div>
              </div>
            </div>
            <div className="production-architecture panel">
              <div className="production-heading">
                <span className="tag">PROPOSED PRODUCTION SYSTEM</span>
                <h3>
                  Production architecture{" "}
                  <span>(roadmap — not built for the ideathon)</span>
                </h3>
                <p>
                  The current demo is a static site. This future service would
                  ingest site evidence and recalibrate pricing.
                </p>
              </div>
              <ol className="production-grid">
                {[
                  {
                    icon: Radio,
                    title: "Site data gateways",
                    sub: "At each BESS: BMS, HVAC and EMS logs",
                  },
                  {
                    icon: LockKeyhole,
                    title: "Secure ingestion",
                    sub: "MQTT / HTTPS with authenticated device connections",
                  },
                  {
                    icon: Layers,
                    title: "Message queue",
                    sub: "Buffer, validate and route incoming site records",
                  },
                  {
                    icon: Database,
                    title: "Time-series database",
                    sub: "Timestamped measurements and auditable history",
                  },
                  {
                    icon: Server,
                    title: "Pricing + annual recalibration",
                    sub: "Containerised services on Kubernetes; autoscale per site / tenant",
                  },
                  {
                    icon: Monitor,
                    title: "API + dashboards",
                    sub: "For OEMs / EPCs, insurers and lenders",
                  },
                ].map((item, i) => (
                  <li key={item.title}>
                    <span className="production-step">0{i + 1}</span>
                    <item.icon size={22} />
                    <h4>{item.title}</h4>
                    <p>{item.sub}</p>
                  </li>
                ))}
              </ol>
              <div className="production-callouts">
                <p>
                  <Server size={17} />
                  <span>
                    Same container images run on-premise for OEMs and insurers
                    who can't share warranty data.
                  </span>
                </p>
                <p>
                  <LockKeyhole size={17} />
                  <span>Data can stay in India.</span>
                </p>
              </div>
              <p className="source-caption">
                Planned deployment options, not implemented data-residency
                guarantees. The supplied Docker image serves this static demo;
                production pricing and ingestion services are roadmap work.
              </p>
            </div>
            <div className="table-scroll equipment-table">
              <table>
                <thead>
                  <tr>
                    <th>Existing equipment</th>
                    <th>Required signal / component</th>
                    <th>Proposed use & implementation condition</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "BMS",
                      "Cell/module temperatures, voltage, current, SoC",
                      "Read-only export or approved gateway; verify sensor quality and timestamps.",
                    ],
                    [
                      "HVAC controller",
                      "Status, faults, setpoint and outage history",
                      "Estimate coupling and outage exposure; verify field behavior against the simple thermal proxy.",
                    ],
                    [
                      "EMS / meter",
                      "Charge/discharge power and energy counters",
                      "Calculate EFC using an agreed energy boundary and define the dispatch envelope.",
                    ],
                    [
                      "Industrial gateway",
                      "Secure local buffering and timestamp synchronization",
                      "Use an existing gateway if available; additional hardware only if logs cannot be exported.",
                    ],
                    [
                      "Capacity-test equipment",
                      "Agreed test load, meters and auxiliary-loss measurements",
                      "Standardize the test protocol and establish the AC/DC measurement bridge before a commercial guarantee.",
                    ],
                  ].map(([a, b, c]) => (
                    <tr key={a}>
                      <td>{a}</td>
                      <td>{b}</td>
                      <td>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="model-disclaimer">
              <Info size={14} /> Live demo: static website + browser worker.
              Equipment connections and recalibration are a proposed
              implementation, not connected services.
            </p>
          </Reveal>
        </section>
        <section id="evidence" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="08"
              kicker="EVIDENCE & HONESTY"
              title="A model should show where it can be wrong."
              description="Which physical assumptions move the Base-case year-10 shortfall probability?"
            />
            <div className="evidence-grid">
              <div className="panel">
                <div className="panel-topline">
                  <span>BASE CASE · ONE INPUT AT A TIME</span>
                </div>
                {story && (
                  <Chart
                    option={tornadoOption(story.tornado, light)}
                    height={370}
                    label="Sensitivity of Base shortfall probability to physical model inputs"
                  />
                )}
                <p className="source-caption">
                  Computed at default inputs with 2,000 samples and common
                  random numbers. Financial inputs change premiums, not physical
                  shortfall probabilities.
                </p>
                <details className="sensitivity-ranges">
                  <summary>Show tested ranges</summary>
                  {story?.tornado.map((s) => (
                    <p key={s.label}>
                      <span>{s.label}</span>
                      <strong>
                        {num(s.lowValue, s.lowValue < 2 ? 3 : 0)} →{" "}
                        {num(s.highValue, s.highValue < 2 ? 3 : 0)} {s.unit}
                      </strong>
                    </p>
                  ))}
                </details>
              </div>
              <div className="evidence-copy">
                <div className="evidence-note">
                  <FlaskConical size={24} />
                  <h3>Where the literature differs.</h3>
                  <p>
                    Wang et al. studied temperature-dependent graphite–LFP cycle
                    aging. Large-format LFP data and models can show different
                    temperature responses.
                  </p>
                  <p>
                    These are different cells, tests and formulations. We expose
                    a <strong>0–40 kJ/mol</strong> sensitivity control instead
                    of treating one coefficient as universal.{" "}
                    <Citation ids={["S6", "S7"]} />
                  </p>
                  <button
                    className="text-link"
                    onClick={() => {
                      whatif("No cycle heat effect", { eaCycle: 0 });
                      document
                        .getElementById("simulator")
                        ?.scrollIntoView({
                          behavior: reduced ? "instant" : "smooth",
                        });
                    }}
                  >
                    Test zero cycle heat effect <ArrowUpRight size={16} />
                  </button>
                </div>
                <ul className="limitations">
                  <li>
                    Probabilities depend on assumed distributions and scenario
                    weights.
                  </li>
                  <li>
                    Monthly climate misses intra-day heat and dispatch dynamics.
                  </li>
                  <li>Cell aging is a proxy for usable system capacity.</li>
                  <li>
                    No knee-point, failure, availability or insolvency model.
                  </li>
                  <li>
                    P95 payout is a reserve proxy, not demonstrated capital
                    adequacy.
                  </li>
                  <li>Simulation precision is not field validation.</li>
                </ul>
              </div>
            </div>
          </Reveal>
        </section>
        <section id="roadmap" className="section-shell section-pad">
          <Reveal>
            <SectionTitle
              number="09"
              kicker="FROM CALCULATION TO CONTRACT"
              title="A clearer decision for every stakeholder."
            />
            <div className="customer-grid">
              {[
                ["OEMs / EPCs", "Price a performance promise before signing."],
                [
                  "Developers",
                  "Compare operating terms and cooling investments.",
                ],
                [
                  "Lenders",
                  "Inspect the assumptions behind capacity exposure.",
                ],
                [
                  "Insurers",
                  "Review transparent scenarios and an audit trail.",
                ],
              ].map(([t, d]) => (
                <div key={t}>
                  <ArrowUpRight size={20} />
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="prior-art panel">
              <div>
                <span className="eyebrow">PRIOR ART, ACKNOWLEDGED</span>
                <h3>A real market. An existing foundation.</h3>
              </div>
              <p>
                Munich Re launched battery performance insurance in 2019. TWAICE
                analytics supported lithium-ion warranty insurance in 2020.
                Hithium announced warranty reinsurance up to 15 years. These
                companies are references, not partners.{" "}
                <Citation ids={["S9", "S10", "S11"]} />
              </p>
            </div>
            <div className="novelty-line">
              <span>OUR PROPOSED DIFFERENTIATION</span>
              <strong>Indian heat + tender thresholds.</strong>
              <strong>Auditable operating terms.</strong>
              <strong>Cooling-versus-premium decisions.</strong>
            </div>
            <h3 className="roadmap-title">The next three months.</h3>
            <div className="roadmap-grid">
              {[
                [
                  "MONTH 01",
                  "Calibrate with reality.",
                  "Seek data from one operating Indian BESS. Compare published LFP models with measured temperature and capacity history.",
                ],
                [
                  "MONTH 02",
                  "Put the rate card to work.",
                  "Seek an OEM/EPC pilot. Test assumptions and operating envelopes against a live bidding workflow.",
                ],
                [
                  "MONTH 03",
                  "Test the commercial structure.",
                  "Discuss the warranty structure with insurers. Extend knee-point and chemistry scenarios; assess longer-term validation needs.",
                ],
              ].map(([m, t, d]) => (
                <div key={m}>
                  <span>{m}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <p className="source-caption">
              Proposed roadmap. No pilots, partnerships or insurer commitments
              have been secured.
            </p>
          </Reveal>
        </section>
        <section
          id="sources"
          className="section-shell section-pad sources-section"
        >
          <SectionTitle
            number="10"
            kicker="SOURCES & ASSUMPTIONS"
            title="Every input has a paper trail."
            description="Evidence supports the structure. Assumptions remain visible and open to challenge."
          />
          <details className="assumption-details" open>
            <summary>
              Model inputs, ranges and provenance <ChevronDown size={16} />
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Value</th>
                    <th>Range / uncertainty</th>
                    <th>Source / qualification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ASSUMPTIONS.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, i) => (
                        <td key={i}>
                          {i === 4 ? (
                            <span
                              className={
                                cell === "SOURCED" ? "status sourced" : "status"
                              }
                            >
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="source-list">
            {SOURCES.map((s) => (
              <article id={`source-${s.id}`} key={s.id}>
                <span>{s.id}</span>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                    <ExternalLink size={13} />
                  </a>
                  <p>{s.note}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer section-shell">
        <a href="#hero" className="wordmark">
          <span className="brand-icon">
            <ShieldCheck size={19} />
          </span>
          Guarantee<span>IQ</span>
        </a>
        <p>Built for Avartan Sustainability Ideathon 2026 · Team GuaranteeIQ</p>
        <span>Price the conditions. Protect the promise.</span>
      </footer>
      <Drawer open={drawer} onOpenChange={setDrawer}>
        <div className="judge-actions">
          {[
            {
              t: "What if heat doesn't affect cycle fade?",
              s: "Set cycle activation energy to zero.",
              p: { eaCycle: 0 },
            },
            {
              t: "Cheaper cell: 6,000 cycles",
              s: "Change the datasheet life endpoint.",
              p: { cycleLife: 6000 },
            },
            {
              t: "Better cell: 10,000 cycles",
              s: "Test a longer cycle-life endpoint.",
              p: { cycleLife: 10000 },
            },
            {
              t: "15 days of HVAC outage",
              s: "Use the Base case with summer cooling outages.",
              p: { ...PRESETS.Base, outages: 15 },
            },
            {
              t: "Guarantee 80% instead of 75%",
              s: "Keep other conditions fixed.",
              p: { guarantee: 0.8 },
            },
            {
              t: "Max SECI cycling (420/year)",
              s: "Use the annual average cycling cap.",
              p: { cycles: CYCLE_CAP },
            },
          ].map((q) => (
            <button key={q.t} onClick={() => whatif(q.t, q.p)}>
              <span>
                <strong>{q.t}</strong>
                <small>{q.s}</small>
              </span>
              <ArrowUpRight size={19} />
            </button>
          ))}
        </div>
        {comparison && (
          <div className="drawer-comparison">
            <h3>{comparison.title}</h3>
            <div>
              <span>Modeled shortfall</span>
              <strong>
                {pct(comparison.before.p10)} →{" "}
                {comparison.after ? pct(comparison.after.p10) : "…"}
              </strong>
            </div>
            <div>
              <span>Premium</span>
              <strong>
                {money(comparison.before.premium)} →{" "}
                {comparison.after ? money(comparison.after.premium) : "…"}
              </strong>
            </div>
          </div>
        )}
        <p className="source-caption">
          Changes apply to the simulator. Results remain conditional on the
          model assumptions.
        </p>
      </Drawer>
      {qaOpen && (
        <div className="qa-overlay">
          <div className="qa-panel panel">
            <div className="panel-topline">
              <span>MODEL ACCEPTANCE · v{MODEL_VERSION}</span>
              <button
                className="text-button"
                onClick={() => {
                  location.hash = "simulator";
                  setQaOpen(false);
                }}
              >
                Close
              </button>
            </div>
            <h2>
              {qaBusy
                ? "Running acceptance checks…"
                : qa?.passed
                  ? "All acceptance checks passed."
                  : "Model validation"}
            </h2>
            <p>
              10,000 simulations · seed 42 · Mulberry32 / Box–Muller. The live
              simulator and rate card use 10,000 simulations per case.
            </p>
            {qa && (
              <>
                <strong className={qa.passed ? "qa-pass" : "qa-fail"}>
                  {qa.checks.filter((c) => c.pass).length} / {qa.checks.length}{" "}
                  PASS
                </strong>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Computed</th>
                        <th>Target</th>
                        <th>Tolerance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qa.checks.map((c) => (
                        <tr key={c.name}>
                          <td>{c.name}</td>
                          <td>
                            {num(c.actual, 3)} {c.unit}
                          </td>
                          <td>{num(c.target, 2)}</td>
                          <td>±{num(c.tolerance, 2)}</td>
                          <td className={c.pass ? "qa-pass" : "qa-fail"}>
                            {c.pass ? "PASS" : "FAIL"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    saveFile(
                      "GuaranteeIQ-QA.json",
                      JSON.stringify(qa, null, 2),
                      "application/json",
                    )
                  }
                >
                  Download QA results
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
