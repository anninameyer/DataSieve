# Methods and interpretation

This guide explains how to prepare data, understand the results and report your analysis in RangeSieve v1.0.0. [Open RangeSieve](https://anninameyer.github.io/RangeSieve/) or return to the [quick start](README.md).

**An outlier flag is a prompt for review, not proof of an error.** RangeSieve keeps the original observations and does not automatically delete them.

## Prepare and check your data

Copy two columns from a spreadsheet: sample identifiers and one numerical variable. You can also paste CSV or TSV text, or a single column of numerical values. Optional headers, decimal points, decimal commas, negative values and scientific notation are supported.

Check the preview before selecting **Analyze dataset**. If the columns or first row are interpreted incorrectly, open **Import settings** and select the delimiter, header setting and columns. Identifiers with leading zeroes are preserved. Duplicate identifiers remain separate observations; blank identifiers receive display labels such as `Row 3`.

Enter the variable name and unit separately. Values should contain numbers without unit symbols or thousands separators. Within a numerical field, a comma means a decimal separator: `1,234` means 1.234. If a line such as `1,5` could mean either two columns or one decimal-comma value, RangeSieve asks you to choose the delimiter.

Empty fields and `NA`, `N/A`, `NaN`, `null`, `missing` or a single dot are treated as **missing**. Other text, dates, infinity, malformed rows and numbers outside the supported numerical range are **invalid**. Whole empty lines are ignored. Missing and invalid observations stay in the review table and exports and do not enter numerical calculations.

RangeSieve accepts up to **50,000 data rows** or **5 million characters**. Input beyond these limits is rejected rather than shortened. Each valid row has equal weight; repeated identifiers do not combine observations.

## Summary statistics

Here, **n** is the number of valid numerical observations. Missing and invalid rows are counted separately.

| Statistic                       | Meaning                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mean                            | The arithmetic average: sum of the values divided by n. Extreme values can strongly affect it.                       |
| Median                          | The middle value after sorting; for an even number of observations, the average of the two middle values.            |
| Sample standard deviation (SD)  | A measure of spread around the mean: `sqrt[sum of (value − mean)² / (n − 1)]`. It requires at least two values.      |
| Minimum and maximum             | The smallest and largest valid values.                                                                               |
| Quartiles Q1 and Q3             | The 25th and 75th percentiles, marking the central part of the distribution.                                         |
| Interquartile range (IQR)       | `Q3 − Q1`, the distance between those quartiles.                                                                     |
| Percentiles                     | Positions in the sorted distribution; RangeSieve also reports the 1st, 5th, 95th and 99th percentiles.               |
| Median absolute deviation (MAD) | The median of the distances from the median: `median(abs(value − median))`. The displayed MAD has no scaling factor. |

**Example:** for `1, 2, 3, 4, 10`, the mean is 4, median is 3, sample SD is about 3.54, Q1 is 2, Q3 is 4, IQR is 2 and MAD is 1.

With no valid values, numerical summaries are unavailable. With one value, the median and percentiles equal that value, IQR and MAD are zero, and SD is unavailable. A constant dataset with at least two values has SD = 0.

### How quartiles and percentiles are calculated

RangeSieve uses **Hyndman–Fan type 7**, a defined rule for interpolating between sorted observations. For percentile proportion `p` (for example, 0.95 for the 95th percentile), its position is `1 + (n − 1)p`, counting the first observation as position 1. A fractional position is interpolated between its two neighboring values.

**Example:** for `1, 2, 3, 4, 5`, the 95th-percentile position is `1 + 4 × 0.95 = 4.8`. It lies 80% of the way from 4 to 5, giving 4.8. This calculated percentile is not an additional observation.

Different quartile definitions can produce different outlier flags, especially in small samples. State **type 7** when reporting the method. The same quartiles are used in summaries, figures and exports. See [Hyndman and Fan (1996)](https://doi.org/10.1080/00031305.1996.10473566).

## IQR outlier screening

IQR screening places lower and upper boundaries, called **fences**, beyond the quartiles:

- Lower fence: `Q1 − multiplier × IQR`.
- Upper fence: `Q3 + multiplier × IQR`.

The default multipliers are **1.5** for mild outliers and **3** for extreme outliers. You can change them under **Detection settings**; the extreme multiplier must be at least as large as the mild multiplier. A value is flagged only when it is strictly beyond a fence. A value exactly on the fence is not flagged. Extreme observations also carry the general IQR flag.

**Example:** if Q1 = 2 and Q3 = 4, IQR = 2. Mild fences are −1 and 7; extreme fences are −4 and 10. A value of 8 is a mild outlier; 11 is extreme. A value of 10 is beyond the mild fence but exactly on the extreme fence, so it is not extreme.

When IQR = 0, the fences coincide; values beyond them can still be flagged. This screening convention follows [Tukey (1977), illustrated by NIST](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm).

## Modified Z-score

The modified Z-score describes how far a value lies from the median relative to MAD. It is less influenced by extreme observations than a score based on the mean and SD:

`M = 0.6745 × (value − median) / MAD`

The score is negative below the median and positive above it. Screening uses its absolute size: the default flag is **|M| > 3.5**. A score exactly equal to ±3.5 is not flagged. The positive threshold can be changed under **Detection settings**.

**Why 0.6745?** It approximates the 75th percentile of a standard normal distribution, about 0.67449. Half of that distribution lies within ±0.67449 standard deviations of its center. Its MAD is therefore about 0.67449 × SD, and the multiplier puts the modified score on a comparable scale. You can calculate the score for non-normal data; the cutoff remains an exploratory screening convention, not a probability that an observation is wrong.

**Example:** for `1, 2, 3, 4, 10`, the median is 3. The distances from the median are `2, 1, 0, 1, 7`, so MAD = 1. The score for 10 is `0.6745 × (10 − 3) / 1 = 4.7215`, which exceeds 3.5.

**If MAD = 0, modified Z-scores and their flags are unavailable for every observation.** No zero score or negative flag is substituted. IQR and expected-range checks remain available independently. The rule follows [Iglewicz and Hoaglin (1993), explained by NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm).

## Expected range and plausibility

Enter an expected minimum, maximum, or both based on scientific knowledge of the variable. Bounds are **inclusive**: values equal to a bound are within range. Leaving both bounds blank gives **Not specified**. Invalid or contradictory bounds must be corrected before continuing.

**Example:** for an expected range of 0–10%, 10% is within range and 11% is outside. An observation can be within the expected range and still be a statistical outlier.

A range violation might reflect a valid rare event, incorrect units, an unsuitable expectation or a measurement error. Review the source information before deciding how to handle it.

## Read the figures and review table

The histogram groups valid values into equal-width bins. The boxplot shows the median, quartiles and individual observations; its whiskers reach the most distant observed values within the mild IQR fences. The violin plot shows a smoothed distribution alongside individual observations. The sorted plot places observations in numerical order. Missing and invalid values appear in the table rather than the figures.

The overall review label prioritizes missing or invalid observations, then values outside the expected range, extreme IQR outliers, other statistical outliers, and finally observations with no statistical flags. Separate flags remain visible: a single observation can meet several criteria. **No statistical flags** does not establish correctness or mean that every check was available.

Use search, sorting and review-only filtering to inspect observations. The underlying dataset is retained. Selecting **Mean line**, **Median line**, **Expected bounds**, **IQR fences** or **Horizontal grid lines** changes the figure display. An expected-bound line requires a specified bound. The histogram’s bin control changes the display rather than the screening thresholds.

### Transformation and processing order

**None (original values)** is the default. Choose **Transformation** and **Apply transformation to** above the figure:

| Scope                                  | Statistics and statistical flags                                                                                                                                                                  | Figure                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Figures only (default)                 | Calculated from original values. Sensitivity comparisons stay in original units.                                                                                                                  | Observations, original summary lines and box summaries are mapped onto the selected scale. |
| Analysis and figures (transform first) | All valid values are transformed first; summaries, type-7 quartiles, IQR/MAD and IQR/modified-Z flags are then calculated on those values. Sensitivity summaries use the same transformed values. | Shows the analyzed values and their calculated summaries, without a second transformation. |

Original identifiers and value text are retained in both modes. **Expected minimum and maximum always refer to original units and are checked against original values.** Their figure positions are transformed when possible; undefined positions are omitted with a notice, without disabling the original-unit plausibility assessment.

| Scale   | Definition and example                                                                          | Requirement                                        |
| ------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| None    | Original values and units.                                                                      | Any valid numerical data.                          |
| Log10   | `log10(x + c)`. Without a pseudocount, c = 0. With c = 1, values 0, 9 and 99 become 0, 1 and 2. | Every valid value plus c must be positive.         |
| Z-score | `(x − mean) / sample SD`. For 1, 2, 3, mean = 2 and sample SD = 1, giving −1, 0, 1.             | At least two values and positive finite sample SD. |

Enable **Add pseudocount** to enter a finite, nonnegative constant in the original units. It is added to **every value**, not only zeros. There is no universal appropriate “small” constant: choose it from measurement units and scientific context, report it and compare justified alternatives. It can strongly affect distances and flags near zero, does not repair erroneous values, and is not automatically a valid model for below-detection measurements. Invalid transformation settings block the selected figure or upfront analysis; no samples are silently dropped. See [NIST's discussion of transformations](https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc47.htm).

Z-scores use the **full valid input dataset** and sample SD with denominator `n − 1`, following the centered convention described in [R's scaling reference](https://stat.ethz.ch/R-manual/R-devel/library/base/html/scale.html). They are unitless, differ from modified Z-scores used for screening, and do not make data normal. As a positive affine transformation, standardization usually leaves IQR/modified-Z decisions unchanged, apart from numerical rounding; log transformation can change them.

**When to use each workflow:**

- **Transform first** when relative differences or multiplicative variation are scientifically meaningful, such as a justified log transformation of right-skewed positive measurements. Your summaries and statistical screening then answer questions on the transformed scale. Transformation alone does not establish normality.
- **Filter first, then transform** when source checks or predefined scientific rules justify removing records before fitting a transformation. Review original-scale results, choose exclusions, and save the complete annotated dataset and report. Under **Compare statistics**, expand **Filter first, then transform a second analysis** and download retained original values. Paste those two columns into a new analysis and choose **Analysis and figures**. This refits parameters to the retained input; report both passes and their rationale. The retained-values file deliberately contains only two original-value columns; its audit is the first report and annotated dataset (also included as settings in Excel).
- **Figures only** when you want a clearer view while retaining measured-unit summaries and screening. Sensitivity exclusions remain a comparison, rather than an automatic cleaning or refitting operation.

In either scope, sensitivity exclusions keep fitted transformation parameters and screening thresholds fixed to the **full input dataset for that analysis**. In particular, retained z-scores are not centered or standardized again. Use the separate filter-first workflow when you intentionally want to fit parameters after exclusions.

Axis titles state the transformation, including the actual pseudocount: values lie on the **y-axis** in boxplots, violins and sorted observations, and the **x-axis** in histograms. Histogram y-values remain counts. Logarithms use the numerical values in the entered units; report those units. Mean/median cards, statistical tables and sensitivity comparisons identify the analysis scale.

**Example of why scope matters:** for 0, 9, 99 and c = 1, transform-first gives a mean of 1 on the log10 scale. Figures-only retains the original mean of 36 and draws its line at `log10(36 + 1) ≈ 1.5682`. Interpolated type-7 quartiles can also differ depending on whether they are calculated before or after a nonlinear transformation. In transform-first mode, boxplots use quartiles calculated after transformation; in figures-only mode, they map the original quartiles. Legends distinguish analyzed-scale summaries from original-unit references.

Histogram bins and violin density use displayed values in both scopes. Scaling can change apparent modality. Captions, reports and spreadsheet settings record the scope, formula, constant and fitted mean/SD; annotated exports preserve parsed original and analysis values separately.

### Violin plots

A violin's width represents a **Gaussian kernel density estimate (KDE)**: each observation contributes a small bell curve, and these curves are averaged. Wider sections indicate a greater concentration of values. Two clusters near 2 and 8 may create two wide lobes with a narrow waist. This can help reveal bimodal distributions, but does not establish distinct populations.

Use **Violin smoothing** to vary the bandwidth multiplier from 0.25 to 2 (default 1). Smaller bandwidths reveal finer structure and may introduce spurious peaks; larger bandwidths can merge real peaks. Compare several settings with the histogram and individual points, especially for small, discrete or widely separated data.

On the displayed scale, the bandwidth is `h = max(0.9 × A × n^(−1/5) × smoothing, observed range/100)`, where `A = min(sample SD, IQR/1.34)` and the IQR uses type 7. If IQR = 0, sample SD is used instead. The 0.9 rule follows **Silverman (1986), p. 48, eq. 3.31**, as documented in [R's bandwidth reference](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/bandwidth.html). The range/100 floor bounds calculation time for large datasets; a notice indicates when it prevents further reduction.

The density is `f(t) = Σ exp(−0.5((t − xᵢ)/h)²) / (n h √(2π))`. Width is normalized to the peak density, rather than counts. The contour stops at the smallest and largest observed values; it is not boundary-corrected or renormalized there. This avoids drawing a silhouette beyond observations, but can still distort bounded distributions. At least two distinct valid values are required for a density; otherwise the figure shows individual points with an explanation. The caption records the actual bandwidth, smoothing multiplier and display scale.

## Sensitivity analysis

Select one or more criteria to compare summaries for all valid observations with summaries after temporarily excluding matching observations. Criteria combine with **OR**: an observation meeting any selected rule is excluded once, even if it meets several rules. Missing and invalid observations are already outside the numerical calculations.

Flags, thresholds and fitted transformation parameters stay fixed to the full dataset on the selected analysis scale. Only the retained-data summaries are recalculated; transformations are not refitted. The displayed changes are **retained summary minus full-data summary**. The percentage excluded uses all valid observations as its denominator. If every valid observation is excluded, retained numerical summaries and changes are unavailable.

**Example:** for `1, 2, 3, 4, 10`, setting an expected maximum of 5 and selecting **Outside expected range** temporarily excludes 10. One of five valid values (20%) is excluded. The mean changes from 4 to 2.5, a change of −1.5; the median changes from 3 to 2.5, a change of −0.5.

This comparison shows how much selected observations affect the summaries. It does not justify exclusion or validate later statistical inference. Document scientifically justified corrections and exclusions separately.

## Save results and manuscript figures

Choose **CSV**, **TSV** or **Excel** under **Data export format**:

| Export                 | Contents                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete dataset       | All original rows and parsed values, analysis values, transformation scope/parameters, flags, review labels and sensitivity-exclusion indicators. |
| Observations to review | Rows requiring review, including missing and invalid values.                                                                                      |
| Statistical summary    | Summary statistics, thresholds, expected bounds, sensitivity comparisons, warnings and the software citation.                                     |
| Analysis report        | A printable HTML report with summaries, settings, worked methods and citations. It does not save an editable analysis session or the raw dataset. |

Excel exports include settings and method/citation sheets. Original identifiers and value text are preserved; spreadsheet programs may round numerical cells or reinterpret CSV/TSV fields. To retain leading zeroes and long original values when importing CSV/TSV, set those columns to **Text**. Potential spreadsheet formulas in text fields are protected with a leading apostrophe. If a field exceeds Excel’s 32,767-character cell limit, use CSV or TSV to retain it in full.

For figures, open **Figure colors & manuscript export**. Choose custom colors with a picker or hex code, or restore the defaults with **Reset figure colors**. Shapes and line styles supplement color; check that custom colors remain distinguishable.

Choose PNG, TIFF, PDF or SVG, print size and resolution (300 or 600 DPI for raster formats). **PDF contains a lossless raster image; SVG provides editable vector graphics.** PNG and TIFF include print-resolution information. Check your journal’s figure requirements. Print dimensions are limited to 80–300 mm and raster images to 25 million pixels; the application explains invalid combinations.

Exported figures show **all valid observations**, even when sensitivity exclusions are selected. Export resets zoom to show the full dataset and uses your selected reference lines, colors and horizontal grid setting. The figure and its embedded metadata have no software branding. **Download figure caption** provides thresholds, settings, methods and the software citation separately.

## Local processing and practical limitations

Opening the online version downloads the application code to your browser. Pasting data places it in temporary browser memory; calculations, figures and export-file creation then run on your device. RangeSieve does not upload your dataset to external servers, share it with third parties, or save the analysis automatically. The offline HTML contains the same application code and works without an internet connection.

Files are saved to your device only when you choose to download them. **Download results before reloading or closing the application.** The offline HTML file is a reusable application, not a saved dataset or session. Browser and operating-system features such as clipboard history, downloaded files and session restoration remain subject to their own settings.

Software development was assisted by **GPT-6.1-Sol (high reasoning setting)**, a large language model. When you analyze a dataset, the local application code applies the formulas described in this guide.

Calculations use standard numerical precision of approximately 15–17 significant digits. Long numbers receive precision warnings; their original text remains available. Unavailable calculations or checks are reported as unavailable rather than treated as negative results. Rescale units if the application explains that a numerical range cannot be plotted or calculated reliably. Displayed summaries are rounded for readability; numerical text exports retain the available calculation precision.

Screening results depend on sample size, distribution shape, precision, thresholds and scientific assumptions. Small, skewed, bounded, multimodal, discrete or dependent datasets require particular care. RangeSieve does not supply hypothesis tests, confidence intervals, false-discovery control or a diagnosis of measurement errors. Choosing thresholds after seeing the results can bias later conclusions.

See the [citation guide](CITING.md) for the software DOI, full method references and an example manuscript methods statement.
