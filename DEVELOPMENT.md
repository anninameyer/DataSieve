# Development and deployment

Technical setup, testing, builds, and deployment instructions for DataSieve maintainers. For using the application, see the [README](README.md).

## Local development

Requires Node.js **22.12+** and npm. Internet access is needed to install development/build dependencies:

```sh
npm ci
npm run dev
```

Open the printed URL (normally `http://127.0.0.1:5173`). **Try an example** loads explicitly synthetic data with typical, mild, extreme, implausible, missing, and invalid observations. Paste your data, review the parsing preview, and select **Analyze dataset**. Bounds and detection settings recompute immediately. Changed input must be analyzed again before export to prevent stale-data downloads.

Vite's development server uses hot reload; this development connection is absent in production. Use the production preview/offline file for privacy verification.

## Build and distribute the offline edition

```sh
npm run build
npm run preview
```

| Output                                                         | Purpose                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `dist/index.html`, `dist/assets/`                              | Static website; relative paths support `/DataSieve/`             |
| `offline/DataSieve.html`                                       | Single-file offline application, opened directly using `file://` |
| `dist/DataSieve.html`                                          | Identical offline file, downloaded from the online sidebar       |
| `dist/{README.md,METHODS.md,LICENSE,THIRD_PARTY_LICENSES.txt}` | Documentation and attribution                                    |

Distribute **only `offline/DataSieve.html`** for a single-file handoff. Its license notices are embedded. Download it, disconnect, and double-click it in a modern browser. No local web server, extension, account, or installation is required. The file is an application, never a saved analysis. Reports/CSVs contain data and should be shared deliberately.

Both builds use `src/main.tsx`. The offline build inlines the same compiled code/styles, uses a classic script authorized by a SHA-256 CSP hash, and needs no module loading over `file://`. Packaging checks for external script/style references and embeds attribution. Build outputs are ignored by Git and recreated in CI.

## Enable GitHub Pages

1. Push this repository, including `package-lock.json`, to GitHub on `main` or `master`.
2. Open [**Settings → Pages**](https://github.com/anninameyer/DataSieve/settings/pages), find **Build and deployment**, and choose **GitHub Actions** as the source. Ensure repository Actions are enabled.
3. Push a commit or open [**Actions → Test, build, and deploy DataSieve**](https://github.com/anninameyer/DataSieve/actions/workflows/pages.yml) and select **Run workflow**.
4. The workflow installs locked dependencies, runs Vitest, type-checks/builds both editions, installs Chromium, and runs Playwright, including the disconnected `file://` test. Deployment requires successful verification.
5. Once both the **verify** and **deploy** jobs succeed, **[open DataSieve](https://anninameyer.github.io/DataSieve/)**. The sidebar offers the offline edition. The **DataSieve-offline** workflow artifact also contains it (90-day retention); artifact downloads may require GitHub login, whereas the Pages download does not.

To check a new deployment, select **Try an example**, confirm the figures and review table appear, and export a table and a figure. Then select **Download offline edition**, disconnect from the internet, and open the downloaded `DataSieve.html` in your browser. Try the example and an export again. If the website still shows an older interface, reload without the browser cache.

Pull requests run all checks and create artifacts without deploying. No custom secrets/backend are needed. The verify job has read-only repository access; only the deployment job has Pages write/OIDC permissions. Actual repository settings and hosted deployment require the repository owner; a local build does not publish remotely.

## Automated validation

Synthetic test data only:

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium # one-time browser installation
npm run test:e2e                 # production online + offline file
npm run check                   # all checks (Chromium must be installed)
```

Vitest covers hand-calculated numerical references, type-7 interpolation, small/empty/constant/negative/extreme samples, zero MAD, overflow/underflow, parsers, duplicate/empty IDs, decimal commas, malformed input, sensitivity unions, CSV fidelity/formula protection, and report escaping. Playwright exercises actual production charts, filtering/sorting, dataset replacement, thresholds, exclusions, all downloads, refresh clearing, tablet overflow, and repository subpaths. Privacy tests monitor requests and WebSockets after data entry, block network access, and prohibit cookie/storage access. Offline tests open the actual file with networking disabled and verify plots, results, exclusions, exports, reload, and CSP errors.

## Project structure

```text
src/
  core.ts          Pure parsing, statistics, classification, sensitivity
  exports.ts       CSV/HTML generation, downloads, method descriptions
  workbook.ts      Typed, formula-free OpenXML Excel workbooks
  figure-model.ts  Palette, figure options and reproducible captions
  figure-export.ts Local Plotly/SVG/canvas figure rendering
  figure-formats.ts Lossless PNG metadata, RGB TIFF and image PDF
  references.ts    Shared worked examples, creator credit and references
  App.tsx          Research workflow and data entry
  Charts.tsx       Bundled Plotly visualizations
  styles.css       Responsive visual design
  main.tsx         Entry point and error boundary
tests/             Vitest reference and edge-case tests
e2e/               Playwright UI, privacy, subpath, offline tests
scripts/package.mjs
vite.config.ts     Shared online/offline builds and CSP
vitest.config.ts
playwright.config.ts
.github/workflows/pages.yml
SPEC.md            Original requirements
METHODS.md         Statistical definitions and limitations
CITING.md          Zenodo setup and manuscript citation guidance
CITATION.cff       Machine-readable software citation metadata
```
