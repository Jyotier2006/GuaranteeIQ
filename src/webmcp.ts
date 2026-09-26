import {
  DEFAULTS,
  normalize,
  PRESETS,
  type Inputs,
  type Scenario,
} from "./model";
// Optional browser-native interface; ordinary browsers need no polyfill or server.
export function registerModelTool(
  run: (p: Inputs) => Promise<unknown>,
  getInputs: () => Inputs,
) {
  const context = (
    document as unknown as {
      modelContext?: {
        registerTool: (
          tool: Record<string, unknown>,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tool = {
    name: "configure_and_price_bess",
    title: "Configure and price a BESS guarantee",
    description:
      "Update the visible simulator and calculate conditional capacity-shortfall risk and a year-10 augmentation premium. Research illustration, not an insurance quote. No data leaves the browser.",
    inputSchema: {
      type: "object",
      properties: {
        scenario: { type: "string", enum: Object.keys(PRESETS) },
        beta: { type: "number", minimum: 0, maximum: 1 },
        cycles: { type: "number", minimum: 0.5, maximum: 420 / 365 },
        outages: { type: "number", minimum: 0, maximum: 30 },
        guarantee: { type: "number", minimum: 0.6, maximum: 0.85 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(value: unknown) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Expected an input object.");
      const v = value as Record<string, unknown>,
        allowed = ["scenario", "beta", "cycles", "outages", "guarantee"];
      if (Object.keys(v).some((k) => !allowed.includes(k)))
        throw new Error("Unknown input.");
      if (
        v.scenario !== undefined &&
        !(typeof v.scenario === "string" && Object.hasOwn(PRESETS, v.scenario))
      )
        throw new Error("Unknown scenario.");
      const ranges: Record<string, [number, number]> = {
        beta: [0, 1],
        cycles: [0.5, 420 / 365],
        outages: [0, 30],
        guarantee: [0.6, 0.85],
      };
      const patch: Partial<Inputs> = {};
      for (const [key, [min, max]] of Object.entries(ranges)) {
        if (v[key] !== undefined) {
          const x = v[key];
          if (
            typeof x !== "number" ||
            !Number.isFinite(x) ||
            x < min ||
            x > max
          )
            throw new Error(`${key} must be between ${min} and ${max}.`);
          (patch as Record<string, number>)[key] = x;
        }
      }
      return run(
        normalize({
          ...DEFAULTS,
          ...getInputs(),
          ...(v.scenario ? PRESETS[v.scenario as Scenario] : {}),
          ...patch,
        }),
      );
    },
  };
  try {
    Promise.resolve(
      context.registerTool(tool, { signal: lifecycle.signal }),
    ).catch(() => {});
  } catch {
    /* Unsupported preview implementations do not break the simulator. */
  }
  return () => lifecycle.abort();
}
