# GuaranteeIQ

A browser-based battery-performance guarantee pricing illustration for **Avartan: Sustainability Ideathon 2026, Track 5**. No deployment has been performed. This package includes source, a production build in `dist/`, and QA evidence.

## Run the finished website

From this folder, with Python 3 installed:

```sh
python -m http.server 8080 --directory dist
```

Open **http://localhost:8080**. Serve through HTTP; do not double-click `dist/index.html`, because browsers restrict ES modules and workers on `file://` URLs. The built site contains its own fonts and assets and does not send model inputs to a server.

## Edit and develop

Use Node 20+ and npm:

```sh
npm ci
npm run dev
```

Open **http://localhost:4173**. After editing:

```sh
npm test
npm run build
npm run preview
```

`npm test` runs the 24 model acceptance checks, using 10,000 simulated projects per scenario and seed 42. `npm run build` checks TypeScript and creates `dist/`. Vercel/Netlify settings are supplied for future use; neither provider was deployed to for this handoff.

## Present the demo

- **P**: high-contrast light projector mode; press again for dark mode.
- **1–9**: jump to hero, gap, simulator, rate card, cooling, method, contract, implementation, evidence.
- **Judge questions**: six one-click what-ifs with before/after comparisons.
- **Share scenario**: stores every input in the URL. Shared links are meaningful after serving the site at a reachable host.
- **Results CSV** / **Chart PNG**: browser-generated exports, no backend.
- **/#qa**: run and display the numerical acceptance panel.
- Hero scenario and month controls illustrate cell temperature. WebGL unavailability or sustained frame rates below 30 trigger the static vector fallback. Reduced-motion preference disables orbit and transitions.

## What was verified

- Production TypeScript/Vite build passed.
- All 24 numerical acceptance tests passed in Node and in the browser worker.
- Browser preset changes, Base + 15 outage days, judge-question comparison, URL restoration, CSV export, PNG export, keyboard navigation, projector toggle and keyboard envelope movement were exercised.
- Desktop and 390 px mobile-frame layouts were inspected; no horizontal body overflow was found in the mobile check.
- Static battery fallback displayed correctly in the available cloud browser. Hardware-accelerated 3D / 60 fps has **not** been certified on a physical device.
- Lighthouse score has **not** been measured; no ≥90 claim is made.
- No application-origin console errors were observed during checks. The testing browser logged unrelated extension-metadata errors.
- Optional WebMCP registration is feature-detected. This preview did not expose a supported context, so its tool execution remains unverified.
- Docker is **not installed in the build environment**. Docker files were checked structurally, but the container has **not** been built or run here. Kubernetes references have not been applied to a cluster.

See `qa/` for exact computed values and screenshots. These are software checks, not battery field validation.

## Model and reproducibility

- `src/model.ts`: the monthly, 144-month stress-time and cycling model, parameter sampling, presets, rate card and acceptance checks.
- `src/model.worker.ts`: Comlink worker API. Monte Carlo computation stays off the UI thread.
- Interactive controls: **10,000 simulations**, seed 42, 150 ms debounce, so presets match the reference figures. Capacity-chart bands are drawn from the first 2,000 of those projects to keep slider updates fast. The rate card also uses 10,000 per cell, in its own worker.
- Hero/gap scenario references and QA: **10,000 simulations**, seed 42. This stabilizes the headline and rare-event reference.
- RNG: Mulberry32 + Box–Muller. A NumPy run with the same numeric seed does not generate the same random sequence. Low-frequency tail payouts vary particularly strongly. The computed 10,000-sample lab premium is approximately ₹0.7 lakh, rather than the team's approximately ₹0.5 lakh; this is disclosed rather than hard-coded or tuned away.
- Each parameter is sampled once per project and persists across its entire path. Scenarios reuse common random numbers for comparisons; uncertain parameters are otherwise sampled independently.
- Average daily cycles are clipped at `420/365`. The specified `30.4` days/month means 364.8 modeled days/year; this minor convention is retained to match the supplied equations.
- At zero cycle activation energy, the cycle-temperature effect and its uncertainty are both set to zero for the judge's what-if.
- The cycle calibration subtracts the assumed baseline calendar loss at 4.4 years. Calendar-coefficient sensitivity does not silently refit that independently sampled cycle coefficient.
- Rate card: β 0.1–0.8 and 0.8–1.15 cycles/day; SOC factor 1.10 and no outages. It uses current contract/finance inputs. The draggable box illustrates proposed contract terms; it does not infer a fitted risk boundary.

10,000-sample values: Base probability **11.51%**, premium **₹34.51 lakh**; Worst probability **52.22%**, premium **₹2.55 crore**; weighted premium **₹81.53 lakh**; Base + 15 outage days **16.80% / ₹54.87 lakh**; Base + 30 days **22.75% / ₹82.55 lakh**. Probabilities are modeled, conditional on stated assumptions.

## Scope and scientific qualifications

The price is a present-value provision for one year-10 augmentation event. It is not a full 15-year warranty or an actuarially validated insurance price. Year 12 is projected separately. The P95 payout is an illustrative reserve proxy, not demonstrated capital adequacy. Capex, augmentation costs, cost decline, discount rate, loading, scenario weights and uncertainty distributions are assumptions.

The Gujarat project is hypothetical. The cited SECI/GRIDCO procurement is in Odisha and measures **AC dispatchable capacity**. This simplified cell-aging model uses a **DC usable-energy proxy**; losses, availability, earlier annual tests and a defined AC/DC bridge must be addressed before a commercial guarantee. At 125 MW, 75% of 500 MWh is 375 MWh, or three hours before other losses.

The supplied daily-mean climate array is retained as an IMD-based team approximation. The linked IMD table lists maxima/minima, not this exact mean array, and differs by 0.1°C for August's maximum. August is outside the outage months. Do not describe the exact daily-mean list as independently verified direct IMD observations.

All primary references and assumptions appear in the website and in `src/evidence.ts`. No cited firm is a project partner. “Team GuaranteeIQ” is a working team label.

## Docker: `docker compose up`

With Docker Engine/Desktop and Compose installed:

```sh
docker compose up
```

Expected endpoint: **http://localhost:8080**. First run builds the image. Use `docker compose up --build` after source changes and `docker compose down` to stop this project.

The multi-stage Dockerfile uses `node:20-alpine` to compile and `nginx:alpine` to serve `/dist` output. Runtime UID/GID is 10001, port 8080, with gzip, immutable caching for hashed assets, SPA fallback, `/healthz`, and a Docker HEALTHCHECK. Compose supplies a writable temporary filesystem while keeping the root filesystem read-only. Base-image tags follow the requested specification; pin reviewed digests for a production release.

**Runtime verification pending:** Docker was unavailable here. Run the supplied smoke check on your machine:

```sh
sh scripts/test-container.sh
```

It checks health, root/SPA pages, non-root UID, asset cache headers and gzip, and shuts down its Compose stack afterward. Do not report “Docker tested” until this command passes.

## Kubernetes references

`k8s/` includes a two-replica Deployment, ClusterIP Service, CPU 70% HPA with 2–10 replicas, and an Ingress with TLS placeholders. Replace the image, hostname, ingress class and TLS secret before use. The HPA needs a resource Metrics API. Resource sizing is illustrative.

These manifests serve the **static demo**. They do not implement the production pricing service shown in the roadmap diagram. In that proposed architecture, BESS gateways feed secure MQTT/HTTPS ingestion, a queue, a time-series store, tenant/site pricing and annual-recalibration services, then APIs and dashboards. On-premise operation and Indian data residency are planned deployment options, not implemented guarantees. No cluster was started.

Infrastructure references: [official Nginx image](https://hub.docker.com/_/nginx), [Kubernetes HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/), [Netlify manual deployments](https://docs.netlify.com/deploy/create-deploys/).

## Package map

`src/` app and model · `public/` icons/host settings · `dist/` runnable build · `scripts/` model and optional container checks · `qa/` results/screenshots · `k8s/` self-hosting references.
