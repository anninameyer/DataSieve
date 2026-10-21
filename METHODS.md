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

The histogram groups valid values into equal-width bins. The boxplot shows the median, quartiles and individual observations; its whiskers reach the most distant observed values within the mild IQR fences. The sorted plot places observations in numerical order. Missing and invalid values appear in the table rather than the figures.

The overall review label prioritizes missing or invalid observations, then values outside the expected range, extreme IQR outliers, other statistical outliers, and finally observations with no statistical flags. Separate flags remain visible: a single observation can meet several criteria. **No statistical flags** does not establish correctness or mean that every check was available.

Use search, sorting and review-only filtering to inspect observations. The underlying dataset is retained. Selecting **Mean line**, **Median line**, **Expected bounds**, **IQR fences** or **Horizontal grid lines** changes the figure display. An expected-bound line requires a specified bound. The histogram’s bin control changes the display rather than the screening thresholds.

## Sensitivity analysis

Select one or more criteria to compare summaries for all valid observations with summaries after temporarily excluding matching observations. Criteria combine with **OR**: an observation meeting any selected rule is excluded once, even if it meets several rules. Missing and invalid observations are already outside the numerical calculations.

Flags and thresholds stay fixed to the full dataset. Only the retained-data summaries are recalculated. The displayed changes are **retained summary minus full-data summary**. The percentage excluded uses all valid observations as its denominator. If every valid observation is excluded, retained numerical summaries and changes are unavailable.

**Example:** for `1, 2, 3, 4, 10`, setting an expected maximum of 5 and selecting **Outside expected range** temporarily excludes 10. One of five valid values (20%) is excluded. The mean changes from 4 to 2.5, a change of −1.5; the median changes from 3 to 2.5, a change of −0.5.

This comparison shows how much selected observations affect the summaries. It does not justify exclusion or validate later statistical inference. Document scientifically justified corrections and exclusions separately.

## Save results and manuscript figures

Choose **CSV**, **TSV** or **Excel** under **Data export format**:

| Export                 | Contents                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete dataset       | All original rows, values, flags, review labels and sensitivity-exclusion indicators.                                                             |
| Observations to review | Rows requiring review, including missing and invalid values.                                                                                      |
| Statistical summary    | Summary statistics, thresholds, expected bounds, sensitivity comparisons, warnings and the software citation.                                     |
| Analysis report        | A printable HTML report with summaries, settings, worked methods and citations. It does not save an editable analysis session or the raw dataset. |

Excel exports include settings and method/citation sheets. Original identifiers and value text are preserved; spreadsheet programs may round numerical cells or reinterpret CSV/TSV fields. To retain leading zeroes and long original values when importing CSV/TSV, set those columns to **Text**. Potential spreadsheet formulas in text fields are protected with a leading apostrophe. If a field exceeds Excel’s 32,767-character cell limit, use CSV or TSV to retain it in full.

For figures, open **Figure colors & manuscript export**. Choose custom colors with a picker or hex code, or restore the defaults with **Reset figure colors**. Shapes and line styles supplement color; check that custom colors remain distinguishable.

Choose PNG, TIFF, PDF or SVG, print size and resolution (300 or 600 DPI for raster formats). **PDF contains a lossless raster image; SVG provides editable vector graphics.** PNG and TIFF include print-resolution information. Check your journal’s figure requirements. Print dimensions are limited to 80–300 mm and raster images to 25 million pixels; the application explains invalid combinations.

Exported figures show **all valid observations**, even when sensitivity exclusions are selected. Export resets zoom to show the full dataset and uses your selected reference lines, colors and horizontal grid setting. The figure and its embedded metadata have no software branding. **Download figure caption** provides thresholds, settings, methods and the software citation separately.

## Privacy and practical limitations

RangeSieve processes data in your browser and does not upload it or automatically save your analysis. **Download results before reloading or closing the application.** The offline HTML file is a reusable application, not a saved dataset or session. Browser and operating-system features such as clipboard history, downloaded files and session restoration remain subject to their own settings.

Calculations use standard numerical precision of approximately 15–17 significant digits. Long numbers receive precision warnings; their original text remains available. Unavailable calculations or checks are reported as unavailable rather than treated as negative results. Rescale units if the application explains that a numerical range cannot be plotted or calculated reliably. Displayed summaries are rounded for readability; numerical text exports retain the available calculation precision.

Screening results depend on sample size, distribution shape, precision, thresholds and scientific assumptions. Small, skewed, bounded, multimodal, discrete or dependent datasets require particular care. RangeSieve does not supply hypothesis tests, confidence intervals, false-discovery control or a diagnosis of measurement errors. Choosing thresholds after seeing the results can bias later conclusions.

See the [citation guide](CITING.md) for the software DOI, full method references and an example manuscript methods statement.
