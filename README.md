# DataSieve

A privacy-first scientific tool for exploring numerical data, reviewing outliers, and assessing plausibility.

**[Open DataSieve →](https://anninameyer.github.io/DataSieve/)**

**Your data stays in your browser. All analyses run locally. No research data is uploaded or stored.**

## Start using DataSieve

1. **[Open the application](https://anninameyer.github.io/DataSieve/)** in a modern browser. No installation, account, or programming is needed.
2. Select **Try an example** to explore synthetic data, or paste two columns copied from Excel: sample identifiers and numerical values.
3. Review the input preview, select **Analyze dataset**, and explore the figures, observations to review, and sensitivity analyses. Download tables and manuscript figures from the application.

**To work offline:** open the application and select **Download offline edition** in the sidebar. Save `DataSieve.html`, then open that file in your browser. It contains the complete application and works without an internet connection. Keep the original downloaded file for reuse; datasets and settings are not saved inside it.

Alternatively, right-click the **[standalone HTML file](https://anninameyer.github.io/DataSieve/DataSieve.html)** and choose **Save link as…** (wording varies by browser). Clicking that link normally opens the standalone edition in the browser. GitHub's **Code → Download ZIP** downloads the source code; use the application’s download button for the ready-to-use offline edition.

The application links become available after the first successful GitHub Pages deployment. If they show a 404 page, check the [deployment workflow](https://github.com/anninameyer/DataSieve/actions/workflows/pages.yml) and the [Pages setup instructions](#enable-github-pages).

**Documentation:** [Methods and limitations](METHODS.md) · [How to cite DataSieve](CITING.md) · [Requirement coverage and trade-offs](REQUIREMENTS.md)

## Features

- Paste two spreadsheet columns from Excel/Sheets; optional headers, CSV/tab/semicolon/space-aligned/single-column input, selectable columns, decimal commas, missing/invalid values, duplicate IDs, and explicit parsing diagnostics.
- All requested descriptive statistics, including sample SD, quartiles, IQR, MAD, and 1st/5th/95th/99th percentiles.
- Adjustable mild/extreme IQR fences, modified Z-scores, independent inclusive plausibility bounds, and multiple flags per row. Statistical extremeness never establishes a confirmed error.
- Interactive histogram with bin/reference-line controls, boxplot with individual labeled observations, and sorted plot colored by review priority. Zoom, hover, and reset. Color-vision-friendly blue/orange/purple/black defaults, distinct symbols/line patterns, and optional researcher-selected colors.
- Search, sort, review-only filtering, and paginated results without removing original rows.
- Sensitivity comparisons using any union of selected criteria, with full-dataset thresholds held fixed.
- Local annotated/review/summary exports in CSV, TSV or genuine Excel (`.xlsx`) format, plus a printable, self-contained HTML report with worked examples, methodological explanations, and citations. Excel stores original identifiers/values as text and parsed observations as numbers.
- Manuscript figure downloads: lossless PNG/TIFF and lossless raster PDF at 300/600 DPI, or editable vector SVG. Choose print dimensions and download a matching caption with actual thresholds and methods. Everything works offline.
- Responsive desktop/tablet design, keyboard controls, explicit labels, skip link, status announcements, and table alternatives to charts.
- Fully bundled static site and a self-contained **DataSieve.html**, with no CDN, fonts, images, or packages fetched at runtime.

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

## Methods

See [METHODS.md](METHODS.md) for equations, assumptions, edge cases, and references. Quantiles use Hyndman–Fan **type 7**; SD uses **n−1**. IQR screening uses strict comparisons with default multipliers 1.5/3. Modified Z is `0.6745 × (x−median)/MAD`, flagged at absolute values >3.5 by default. **Zero MAD disables modified Z for every observation.** Expected bounds are inclusive and independent. Sensitivity criteria combine with OR, holding full-dataset flags fixed.

An outlier is not a confirmed reporting error. Source-record review, study design, domain expertise, and prespecified rules must guide actual cleaning decisions.

“Understand the methods” introduces each metric with a worked numerical example. In particular, `0.6745` approximates the standard normal 75th percentile; normal-distribution MAD is approximately `0.67449 × SD`. It scales the modified score without requiring the observed data to be normal. The cutoff of 3.5 remains a screening convention.

## Figure exports and manuscript supplements

Open **Figure colors & manuscript export** below the chart. Default colors adapt the blue/orange/reddish-purple/black subset of [Okabe–Ito](https://jfly.uni-koeln.de/color/); distinct circle/triangle/square/diamond symbols and solid/dashed/dotted lines supplement color. Use a color picker or enter a six-digit hex code. Choosing a mean, median or expected-bound color also enables that reference line; expected bounds must first be specified. Mean and median reference lines work in all three plots. Custom colors may reduce distinguishability; **Reset figure colors** restores defaults. Choices live only in memory.

Select PNG, TIFF, PDF or SVG, resolution (300/600 DPI) and physical dimensions (80–300 mm, limited to 25 million raster pixels). Default print size is 180 × 140 mm. Export uses a white background, resets zoom to show the full dataset, and includes a legend and enabled reference lines. **Horizontal grid lines** can be shown or hidden, with the same choice applied to exports. Figures, embedded image metadata and filenames have no software branding. Exports do not apply sensitivity exclusions. PNG and TIFF embed physical-resolution metadata. TIFF is uncompressed 8-bit RGB. PDF embeds the same lossless raster at its print size; **it is not vector**. Choose SVG for editable vector graphics. No CMYK/ICC conversion is performed; check the target journal’s requirements.

**Download figure caption** records the variable, valid count, actual fences/multipliers/Z threshold, expected bounds, visible lines/grid, palette, bins, print settings, interpretation, software version, and method references. Scientific settings are also embedded in the figure metadata; software credit stays in the separate caption, report and citation section. Thresholds are descriptive screening choices; a figure does not establish a scientific justification for excluding observations.

## Creator credit and citation

Created by [@anninameyer](https://github.com/anninameyer). The interface, report, workbook, and figure captions include software credit. [CITATION.cff](CITATION.cff) prepares GitHub’s **Cite this repository** feature. [CITING.md](CITING.md) explains how to archive a release on Zenodo, add the real version DOI, specify a confirmed publication name/ORCID, and cite the methods actually used. No DOI is fabricated, no Zenodo connection is embedded in the app, and no release is published automatically.

## Privacy and security

- Data exists in memory only. No backend, database, accounts, analytics, telemetry, cookies, localStorage, sessionStorage, IndexedDB, service worker, or persistent analysis storage.
- Runtime dependencies are bundled. Production CSP blocks connections (`connect-src 'none'`), workers, objects, and form submissions. The offline executable uses a content hash; no eval or inline event handlers.
- No automatic external requests. Methodology links open only through explicit user action. The hosting provider serves the static site and may keep infrastructure access logs, but receives no entered research data.
- CSV/TSV fields are quoted; potentially executable spreadsheet text gets a leading apostrophe. XLSX uses typed string cells for original fields (no executable formulas or external links), numerical cells for parsed values, and additional methods/settings sheets. The HTML report escapes user text and blocks scripts/network resources. Import identifier/original-value CSV/TSV columns as **Text** in spreadsheets to preserve leading zeroes and precision.
- Refresh or **Clear session** creates an empty analysis. Browser/OS clipboard, downloads, caches, extensions, and session/form restoration are outside the app's control. Cached website assets contain no research data.

## Limitations and verification scope

- One numerical variable, up to 50,000 data rows / 5 million characters. Larger input is explicitly rejected, never truncated. Large SVG plots may be slow; table pagination does not omit rows.
- Header inference recognizes common names; explicit controls handle other names. Numeric comma-only lines require a CSV-vs-decimal choice. Commas within a field mean decimals, never thousands grouping. Dates, grouping separators, embedded units, and workbook files are unsupported.
- IEEE 754 double precision; no arbitrary precision. Unrepresentable quantities/flags are unavailable with warnings. Charts explicitly decline scales beyond approximately `10^±100` or overflowing spans and suggest rescaling, while data/statistics remain available. Sample SD requires two values; small-sample flags are unstable.
- Values with more than 15 significant digits or outside the safe integer range receive visible precision diagnostics; original text is retained. Representable finite numbers remain valid for analysis.
- Excel cells are limited to 32,767 characters; oversized fields produce an explicit export error directing users to CSV/TSV, never truncation. Excel numeric cells can round to 15 significant digits independently; original field strings are preserved for fidelity. Workbooks contain calculated results, not a live analysis or formulas.
- Screening is exploratory, with no error diagnosis, formal hypothesis tests, confidence intervals, or false-discovery control. Skewed, dependent, discrete, multimodal, and small samples need special care.
- Automated browsers target Chromium. Firefox/Safari, screen-reader usability, formal accessibility compliance, and a live GitHub Pages deployment need additional release validation. The Actions workflow is ready to deploy once enabled in GitHub.
- Network is required for installing build dependencies and initially loading the hosted site. Analyses and the offline distribution require no network or external runtime resources.

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

## Licensing

DataSieve is [MIT licensed](LICENSE). React, React DOM, Scheduler, Plotly.js, and fflate are bundled with their permissive license notices in `THIRD_PARTY_LICENSES.txt` and inside the offline HTML. Retain notices when redistributing. `read-excel-file` is a development-only independent reader used to validate exported workbooks; it is not included in the application.
