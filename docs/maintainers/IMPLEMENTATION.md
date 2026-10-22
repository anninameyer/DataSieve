# Statistical implementation reference

Maintainer reference for numerical algorithms and export behavior. Researchers should use the [methods guide](../../METHODS.md).

Version 1.0.0. All computation happens in browser memory. No observation is automatically deleted. Screening flags do **not** establish a reporting error.

## Input, missing values, and denominators

Each record retains its original identifier, original value text, parsed value, status/diagnostic, and one-based data-record index. Source row numbers exclude a header/empty lines; multiline CSV records count once. Original fields preserve whitespace and leading zeroes. Empty IDs receive display labels `Row …` while their original empty identifier remains in exports. Duplicate IDs remain separate rows, with a warning.

Supported text: Excel tabs, RFC-style CSV (quoted fields, doubled quotes, multiline fields), semicolons, columns aligned with two or more spaces, or one value per line. Auto detection examines the first nonempty line and prioritizes tabs, semicolons, unquoted commas, space alignment, then single-column input. Override the delimiter/header/column controls when needed. Space alignment splits two-or-more whitespace characters; use tabs/quoted CSV for identifiers with multiple spaces.

Header detection is conservative: common identifier headings such as `Sample_ID`, `ID`, `identifier`, `subject_id`, or single-column `value`, `measurement`, or `observation`. Unrecognized first rows are retained; select **Headers present** for other headers. A real ID could resemble a header: select **No headers** to retain it. Always review the preview.

Numeric syntax supports signs, decimals, and scientific notation. Outer whitespace is ignored for interpretation, never removed from the stored original field. Decimal commas work inside unambiguous fields (`S1<TAB>2,5`, `S1;2,5`, `S1,"2,5"`). Numeric-only `1,5` could mean two CSV columns or one decimal-comma value: auto import stops for an explicit choice. **Commas inside fields mean decimals, never thousands grouping**; `1,234` means 1.234. Mixed punctuation, grouping, units, percentages, and dates are not stripped or guessed.

Missing values: empty fields or case-insensitive `NA`, `N/A`, `NaN`, `null`, `missing`, or `.`. Other nonnumbers, infinity, input overflow (`1e999`), nonzero underflow (`1e-999`), and incorrect field counts are **invalid**. Malformed/unclosed CSV quotes stop import. Whole empty lines are ignored; rows containing delimiters still count, with empty value fields classified as missing. Input limits are 50,000 data records / 5 million characters; exceeding them rejects input without truncation.

Let `N` be input data records and `n` finite valid observations. `N = n + missing + invalid`. All numerical statistics use n valid equally weighted observations; duplicate IDs do not deduplicate values. Missing/invalid records remain in the table and exports and never become zero.

## Descriptive statistics

For valid values x₁,…,xₙ:

- Arithmetic mean: `x̄ = Σxᵢ/n`.
- Sample standard deviation: `s = sqrt[Σ(xᵢ−x̄)²/(n−1)]`, unavailable for n < 2.
- Median: `Q(0.5)`; Q1 = `Q(0.25)`; Q3 = `Q(0.75)`; IQR = Q3−Q1.
- Percentiles: `Q(0.01)`, `Q(0.05)`, `Q(0.95)`, `Q(0.99)`.
- Minimum/maximum: smallest/largest valid value.
- Raw MAD: `median(|xᵢ−median(x)|)`; the displayed MAD has no additional consistency factor.

With n = 0, numerical quantities are unavailable. With n = 1, location/quantiles equal the observation, IQR/MAD are zero, and SD is unavailable. A constant sample with n ≥ 2 has SD = 0.

### Quantile definition: Hyndman–Fan type 7

For sorted zero-indexed x[0] ≤ … ≤ x[n−1] and 0 ≤ p ≤ 1:

```text
h = (n−1)p
j = floor(h)
t = h−j
Q(p) = (1−t)x[j] + t x[j+1]
```

When t = 0 return x[j] directly; p = 1 returns the maximum. This is R's default type 7 convention. Other conventions can change fences, especially for small samples. For [0,1,2,3], Q1 = .75, median = 1.5, Q3 = 2.25. Plotly receives these precomputed quartiles rather than selecting another definition.

### Numerical precision

Calculations use JavaScript IEEE 754 binary64 (~15–17 significant digits). Fields with more than 15 significant digits or parsed integers outside the safe integer range receive visible precision warnings; finite representable values remain valid and original text is preserved. Mean uses scaling and compensated summation. SD centers around an observed midpoint and scales deviations before squaring, with a magnitude-scaled fallback when subtraction overflows. Quantile interpolation avoids overflowing the difference of extreme opposite-sign numbers. These reduce avoidable error; they are not exact decimal or arbitrary-precision arithmetic. Extreme dynamic ranges and nearly identical huge values can lose precision.

Nonfinite derived quantities are unavailable with a warning. An unavailable check is distinct from a negative flag. If one finite fence demonstrates an outlier that positive indicator remains; otherwise an unavailable opposing fence makes the indicator unavailable. Rescale units when needed. Dashboard values round for readability (seven significant digits, or four decimal places in scientific notation); CSV numerical results use full JavaScript round-trip precision.

## IQR screening

For configurable positive mild/extreme multipliers kₘ ≤ kₑ (defaults 1.5 and 3):

```text
L_mild = Q1 − kₘ×IQR       U_mild = Q3 + kₘ×IQR
L_extreme = Q1 − kₑ×IQR    U_extreme = Q3 + kₑ×IQR
```

IQR flag: x < L_mild OR x > U_mild. Extreme flag: x < L_extreme OR x > U_extreme. Comparisons are **strict**; equality is unflagged. Extreme observations also carry the general IQR indicator. Table class is extreme, otherwise mild, otherwise within fences, or unavailable. When IQR = 0 the fences coincide and values beyond them are still flagged.

Boxplot whiskers reach the most extreme **observed** values within mild fences. All valid observations are overlaid with deterministic horizontal jitter that does not change their numerical value. Multipliers update fences, whiskers, flags, and sensitivity comparisons. Histogram bins divide the observed span into equal-width intervals. A tiny outer padding (one millionth of the span at each end) includes the maximum in Plotly’s right-open bins; constant samples receive display padding of max(0.5, 1% of the absolute value). Bars aggregate counts; point-level review colors appear in the other plots. Plotly supplies hover/zoom/reset. Scales beyond approximately 10^±100 or overflowing spans receive explicit rescaling guidance instead of a misleading chart; underlying data remains available.

## Figure display transformations and violin density

`src/plot-scale.ts` defines pure transformations and explicit violin bandwidth; `src/processing.ts` assembles the selected analysis and its serializable audit. `src/processing-types.ts` separates shared types from runtime imports. App owns the scope/scale/pseudocount controls; all downstream views and exports receive the same analysis record. None/figures-only are defaults. Log10 uses `log10(x + c)`, with an optional finite nonnegative c added to every value. Nonpositive shifted inputs reject the entire selected view/analysis; no silent filtering occurs. Stable log addition avoids overflowing a representable transformed result. Standard z-scores use the original full-data mean and sample SD, with guarded subtraction for extreme opposing signs; constant/singleton data report unavailability.

In figures-only mode, screening, summary tables and sensitivity use raw values. In upfront mode, copied valid observations have transformed `value` and preserved `rawValue`/`original`; `analyze` fits summaries and statistical flags to the transformed values. Original-unit plausibility is copied from the raw assessment, with review priority recomputed independently. Expected settings remain in original units and their drawable positions are stored separately. Invalid upfront processing returns an empty, explicitly unavailable analysis with the audit/error attached; exports are disabled until corrected. Parsed input is never mutated.

The value axis is labelled with transformation and exact c (histogram x, otherwise y). Figures-only reference lines and precomputed type-7 box summaries are mapped from raw statistics. Upfront figures show transformed values and summaries directly, with no second transform. Nonrepresentable enabled reference lines are disclosed in the UI/captions. Histogram bins and Gaussian violin KDE use displayed values. The existing Cartesian Plotly bundle supplies violin support, with its internal box/mean displays disabled. Point symbols retain review classes.

Sensitivity always uses fixed full-input parameters and thresholds on the selected analysis scale. A separate two-pass filter-first workflow exports retained original values as two columns for reimport; complete annotated results/reports preserve the first-pass audit, and retained Excel downloads also include settings. Reimport intentionally refits all parameters to the new input. Tabular exports append analysis values and scope/parameters without replacing the original parsed-value column; all summaries, reports, workbooks and neutral figure metadata identify processing order and scale.

The explicit bandwidth is `max(0.9 × A × n^(-1/5) × smoothing, range/100)`, A = min(sample SD, type-7 IQR/1.34), falling back to SD when IQR is zero. Smoothing is 0.25–2, default 1. The range/100 floor bounds Plotly's bandwidth/3 evaluation grid to approximately 301 positions (about 15 million kernel evaluations for 50,000 rows). Floor activation is disclosed. Fewer than two distinct values show points only. The Gaussian contour uses `spanmode: hard` (observed extrema), is peak-width normalized, and is not boundary-corrected or renormalized. See the user methods guide and Silverman reference for interpretation. Captions and neutral metadata preserve scale parameters, actual bandwidth and omissions. All figure formats and both builds share these settings; tabular exports retain original units.

## Modified Z-score

```text
MAD = median(|xᵢ − median|)
Mᵢ = 0.6745 × (xᵢ − median) / MAD
Flag if |Mᵢ| > c; default c = 3.5 (configurable, positive)
```

The constant/cutoff follow the Iglewicz–Hoaglin screening rule discussed by NIST. The table/exports show signed scores; classification uses absolute magnitude.

**Where does 0.6745 come from?** It rounds the 75th percentile of the standard normal distribution: `Φ⁻¹(0.75) ≈ 0.67448975`. Half of a normal population lies within ±0.67449 population standard deviations of its center, giving population MAD ≈ 0.67449×SD. Multiplying the standardized median/MAD distance by this constant makes its scale comparable with a conventional Z-score for normal data. Computing the score does not require normally distributed observations, and the scaling does not turn the 3.5 cutoff into an error probability.

**Worked example:** for `[1,2,3,4,10]`, median = 3; absolute distances are `[2,1,0,1,7]`, so MAD = 1. The score of 10 is `0.6745×(10−3)/1 = 4.7215`, which exceeds 3.5. For this same dataset, mean = 4, sample SD ≈ 3.54, Q1 = 2 and Q3 = 4; mild IQR fences are −1/7 and extreme fences are −4/10. The value 10 is a mild IQR outlier and modified-Z outlier but is exactly on the upper extreme fence, so its extreme IQR flag is false. Each method remains independent. Further first-time-reader examples appear in the interface, report, and workbook.

**If MAD = 0**, scores and Z indicators are unavailable for **every** observation, including those equal to the median. No zero, infinity, epsilon, or false indicator is substituted. IQR and range checks remain independent. Unrepresentable individual Z-scores are also unavailable with a warning. This is a screening rule, not a hypothesis test or error diagnosis.

## Plausibility range

Expected minimum a and maximum b are optional and **inclusive**. Either can be supplied independently. Violation: `(a supplied AND x < a) OR (b supplied AND x > b)`. At least one boundary is needed for a within/outside assessment; otherwise status is **not specified**. Missing/invalid observations cannot be assessed. Contradictory/nonfinite bounds disable results/exports until corrected.

Ranges encode researcher expectations independently of distributional flags. A violation might represent a rare valid event, wrong units, an unsuitable expectation, or an error; RangeSieve cannot decide which.

## Independent indicators and overall review priority

Value status, IQR/extreme flags, signed Z and Z flag, and plausibility remain independent. `Unavailable` differs from `No`; unspecified range differs from an assessment. Overall priority is the first applicable category:

1. Invalid or missing value.
2. Outside expected range.
3. Extreme statistical outlier (extreme IQR).
4. Statistical outlier (general IQR OR modified Z).
5. No statistical flags.

This orders review, not error probability. “No statistical flags” neither establishes correctness nor means every method was available. Modified Z has a single screening threshold, not a separate extreme category. Review-only filters/exports include invalid/missing records. Charts contain valid numerical observations only; the table retains every row.

## Sensitivity analysis

All criteria start unselected. Available rules: outside expected range, extreme IQR, all IQR (includes extreme), modified Z. A valid row is excluded if **any** selected rule is positively flagged (OR/union). Overlapping rules count a row once; unavailable checks do not cause exclusion.

Flags and thresholds remain fixed to the **full original dataset**. Statistics are recomputed on retained values without iterative outlier removal or threshold refitting. Original rows never change.

```text
excluded = n_all_valid − n_retained
percent_excluded = 100 × excluded / n_all_valid
mean_change = mean_retained − mean_all_valid
median_change = median_retained − median_all_valid
```

For no valid data the excluded percentage is zero (“no valid data”); changes are unavailable. Excluding every valid observation yields n = 0 and unavailable retained numerical statistics/changes. Missing/invalid rows are outside numerical denominators and do not count as sensitivity exclusions.

This measures dependence of summary statistics on selected observations. It does **not** scientifically justify cleaning, correct bias, or validate downstream inference. Apply domain/source-record review and record real cleaning rules separately.

## Exports and reproducibility

- Annotated CSV: source row, original/display identifiers, original/parsed values, status/diagnostic, independent flags, signed Z, review priority, sensitivity exclusion.
- Review CSV: all non-default review categories, including missing/invalid.
- Summary CSV: metadata, counts, definitions, all descriptive statistics/MAD, multipliers/fences/Z threshold, expected bounds, selected exclusion criteria, retained statistics, excluded count/percentage, changes, warnings. Blank summary values mean unavailable/not specified.
- HTML report: self-contained/printable/escaped, no executable scripts, with metadata, timestamp, summaries, thresholds, review counts, sensitivity settings/results, methods, limitations. Contains summaries, not the raw dataset or an app session.

The three tabular exports are available in **CSV, TSV and Excel (`.xlsx`)**. TSV uses tab separation with the same quoting, BOM, CRLF and text formula protection as CSV. XLSX uses typed original strings, parsed numeric cells, and booleans; it does not create formulas, macros or external links. It contains settings and shared worked-method/citation sheets. An oversized Excel field is rejected explicitly at 32,767 characters; use CSV/TSV instead. Excel’s independent 15-digit numeric precision does not alter the retained original text.

Figures export locally as lossless PNG/TIFF or lossless-image PDF at 300/600 DPI, and as editable vector SVG. Physical size is configurable; resolution metadata is embedded. TIFF is baseline uncompressed 8-bit RGB. PDF is raster, not vector; use SVG for editable lines/text. A white background, full-dataset axes, enabled reference lines, labels and legend are exported, independent of sensitivity exclusions. Horizontal grid visibility applies equally to every plot and its export. Embedded scientific metadata records thresholds, range, bins, palette, line/grid visibility and interpretation; the artwork, metadata and filenames contain no software branding. The separate caption and report retain software version and citation. Viewport zoom is reset for exports, never silently presented as the complete dataset. Default figure colors adapt Okabe–Ito blue/orange/reddish purple/black and use additional marker shapes and line patterns; custom colors are the researcher’s choice and may reduce accessibility. Hex-code inputs supplement native color pickers; choosing a line color enables the corresponding line, with supplied bounds required for expected-range lines. Median and mean reference lines are available in all plots.

CSV uses RFC 4180 quoting, CRLF, UTF-8 BOM, and spreadsheet formula protection. Text beginning with potential formulas (`= + - @`, allowing leading whitespace) or control characters receives a **leading apostrophe**, unless it is a valid numerical field. This disclosed security transformation does not change the in-memory original. Spreadsheet software can independently reinterpret leading zeroes or large-number precision: import original-value/identifier columns as **Text** when preserving them matters.

## Interpretation and limitations

These complementary exploratory rules are not formal hypothesis tests or a validated error classifier. No p-values, confidence intervals, false-discovery control, normality claim, confirmed-error category, or automatic cleaning advice is supplied. Flags depend on sample size, cutoffs, precision, distribution shape, dependence, and domain assumptions. Skewed, bounded, multimodal, discrete, dependent, very small, or contaminated samples may yield misleading flags or miss errors. Correlated methods can mask outliers or flag valid subpopulations. Choosing cutoffs after seeing results can bias inference.

Review records, units, instruments, study design, and context. Save an independent audit of justified corrections. RangeSieve processes pasted data in temporary browser memory without dataset upload to external servers, external sharing, or automatic analysis saving; refresh/clear resets memory. Downloads deliberately save information locally. Browser/OS clipboard, caches, extensions, and session restoration are outside application control.

## References

- Hyndman, R. J. & Fan, Y. (1996). _Sample Quantiles in Statistical Packages_. The American Statistician 50(4), 361–365. [DOI](https://doi.org/10.1080/00031305.1996.10473566).
- R stats: [Sample Quantiles, default type 7](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html).
- NIST/SEMATECH: [Detection of Outliers](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm), including the Iglewicz–Hoaglin modified-Z rule.
- NIST/SEMATECH: [Outlier boxplot fences](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm).
- Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley. Source for the IQR fence convention; RangeSieve uses type-7 quartiles rather than Tukey hinges.
- Iglewicz, B., & Hoaglin, D. C. (1993). _How to Detect and Handle Outliers_. ASQC Quality Press.
- NIST Dataplot: [Median Absolute Deviation and normal-consistency scaling](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm).
- Okabe, M., & Ito, K. [Color Universal Design](https://jfly.uni-koeln.de/color/).
- Plotly, Inc. [Plotly.js v3.7.0](https://github.com/plotly/plotly.js/tree/v3.7.0), interactive figure software.

See [citation guide](../../CITING.md) for software credit, the archived release DOI, and manuscript citation guidance. R’s documentation describes the matching quantile convention; RangeSieve calculates its own statistics and does not execute R.
