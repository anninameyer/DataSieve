export const SOFTWARE = {
  name: 'RangeSieve',
  title: 'RangeSieve: numerical data exploration and outlier review',
  version: '1.0.0',
  releaseDate: '2026-10-21',
  author: 'Annina R. Meyer',
  citationAuthor: 'Meyer, A. R.',
  orcid: 'https://orcid.org/0009-0006-3110-6598',
  handle: '@anninameyer',
  repository: 'https://github.com/anninameyer/RangeSieve',
  profile: 'https://github.com/anninameyer',
  // This DOI identifies v1.0.0; update it when a different software version is archived.
  doi: '10.5281/zenodo.23540904',
};

export const softwareCitation = () =>
  `${SOFTWARE.citationAuthor} (${SOFTWARE.releaseDate.slice(0, 4)}). ${SOFTWARE.title} (Version ${SOFTWARE.version}) [Computer software]. ${SOFTWARE.doi ? `Zenodo. https://doi.org/${SOFTWARE.doi}` : SOFTWARE.repository}`;

export const dataHandlingNotice =
  'Pasted data is processed locally in your browser. RangeSieve does not upload it to external servers, share it with third parties, or save your analysis automatically.';

export const developmentAcknowledgement =
  'Software development was assisted by the large language model GPT-6.1-Sol (high reasoning setting). Dataset analysis is performed by the local application code.';

export const references = [
  {
    id: 'quantiles',
    title:
      'Hyndman, R. J., & Fan, Y. (1996). Sample Quantiles in Statistical Packages. The American Statistician, 50(4), 361–365.',
    url: 'https://doi.org/10.1080/00031305.1996.10473566',
    use: 'Source of the quantile classification; RangeSieve implements type 7.',
  },
  {
    id: 'iqr',
    title: 'Tukey, J. W. (1977). Exploratory Data Analysis. Addison-Wesley.',
    url: 'https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm',
    use: 'IQR fence convention; linked NIST illustration. Quartiles here use type 7, not Tukey hinges.',
  },
  {
    id: 'modified-z',
    title:
      'Iglewicz, B., & Hoaglin, D. C. (1993). How to Detect and Handle Outliers. ASQC Quality Press.',
    url: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm',
    use: 'Modified Z-score and the conventional 3.5 screening threshold; linked NIST explanation.',
  },
  {
    id: 'mad',
    title: 'NIST Dataplot reference: Median Absolute Deviation.',
    url: 'https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm',
    use: 'Definition of MAD and normal-consistency scaling.',
  },
  {
    id: 'transformations',
    title: 'NIST/SEMATECH e-Handbook: Checking Assumptions; R base: Scaling and Centering.',
    url: 'https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc47.htm',
    use: 'Scientific context for log transformation and adding a constant before taking logs. Standardization uses the centered sample SD convention documented at https://stat.ethz.ch/R-manual/R-devel/library/base/html/scale.html. Neither choice guarantees normality or justifies excluding data.',
  },
  {
    id: 'kde',
    title:
      'Silverman, B. W. (1986). Density Estimation for Statistics and Data Analysis. Chapman & Hall. p. 48, eq. 3.31.',
    url: 'https://stat.ethz.ch/R-manual/R-devel/library/stats/html/bandwidth.html',
    use: 'Gaussian violin density bandwidth rule (0.9 variant), with sample SD fallback for zero IQR, adjustable smoothing and a range/100 computational floor; linked R documentation.',
  },
  {
    id: 'palette',
    title: 'Okabe, M., & Ito, K. Color Universal Design.',
    url: 'https://jfly.uni-koeln.de/color/',
    use: 'Default figure palette adapted from the blue, orange, reddish purple, and black colors, reinforced with shapes and line patterns.',
  },
  {
    id: 'plotly',
    title: 'Plotly, Inc. Plotly.js, version 3.7.0 [Software].',
    url: 'https://github.com/plotly/plotly.js/tree/v3.7.0',
    use: 'Interactive figures. RangeSieve computes its own statistics; R is not used to run the analysis.',
  },
];

export const methods = [
  {
    title: 'Mean, median and standard deviation',
    explanation:
      'The mean is the arithmetic average. The median is the middle value after sorting (the midpoint of the two middle values for an even sample). Sample standard deviation describes how far values typically spread around the mean; large values increase it strongly.',
    formula: 'Mean = sum of values / n; sample SD = √[sum of (value − mean)² / (n − 1)]',
    example:
      'For 1, 2, 3, 4, 10: mean = 4, median = 3 and sample SD ≈ 3.54. The high value pulls the mean above the median.',
    detail:
      'n counts valid numbers only. Sample SD needs at least two numbers; location summaries are unavailable when n = 0.',
  },
  {
    title: 'Quartiles and percentiles (type 7)',
    explanation:
      'A percentile marks a position in the sorted distribution. Q1 and Q3 are the 25th and 75th percentiles; the interval between them covers the central half of the distribution. Type 7 is a reproducible rule that interpolates between adjacent observations.',
    formula:
      'For sorted values indexed from 0: h = (n − 1)p, j = floor(h), t = h − j; Q(p) = (1 − t)x[j] + t x[j + 1].',
    example:
      'For 1, 2, 3, 4, 5: Q1 = 2, median = 3 and Q3 = 4. At the 95th percentile, h = 3.8, so Q(0.95) = 0.2 × 4 + 0.8 × 5 = 4.8. Interpolation does not create a new observation.',
    detail:
      'Different quartile rules can produce different outlier flags, especially in small samples. RangeSieve consistently uses Hyndman–Fan type 7 in statistics, figures and exports.',
  },
  {
    title: 'IQR screening',
    explanation:
      'The interquartile range (IQR) is Q3 − Q1: the width of the central half of the data. Fences extend this range to screen for unusually distant values. The default multipliers are 1.5 for mild and 3 for extreme outliers; both can be changed.',
    formula: 'Lower fence = Q1 − multiplier × IQR; upper fence = Q3 + multiplier × IQR.',
    example:
      'If Q1 = 2 and Q3 = 4, IQR = 2. Mild fences are −1 and 7; extreme fences are −4 and 10. A value of 8 crosses the mild fence; 11 crosses both. A value exactly on a fence is not flagged.',
    detail:
      'Extreme outliers also carry the general IQR flag. If IQR = 0, fences coincide and values beyond them can still be flagged. Unusual does not mean incorrect.',
  },
  {
    title: 'Modified Z-score',
    explanation:
      'This score measures how far a value lies from the median using a spread measure that resists extreme observations. MAD (median absolute deviation) is the median of the distances |value − median|. The score is signed; screening uses its absolute size, with default |M| > 3.5.',
    formula: 'M = 0.6745 × (value − median) / MAD',
    example:
      'For 1, 2, 3, 4, 10, the median is 3. Distances are 2, 1, 0, 1, 7, so MAD = 1. For 10, M = 0.6745 × 7 / 1 = 4.7215, above 3.5.',
    detail:
      'Why 0.6745? It rounds the 75th percentile of a standard normal distribution, Φ⁻¹(0.75) ≈ 0.67448975. Half of a normal distribution lies within ±0.67449 standard deviations of its center, so its MAD is approximately 0.67449 × SD. This factor puts M on a roughly familiar standard-deviation scale for normal data; it does not assume your data are normal. The 3.5 cutoff is a screening convention, not a probability of error. If MAD = 0, scores and Z flags are unavailable for every row; no fictitious zero or infinity is used.',
  },
  {
    title: 'Plausibility and review priority',
    explanation:
      'An expected range expresses your scientific knowledge, independently of the distribution. Bounds are inclusive; either can be left blank. A range violation and a statistical outlier are separate findings, and neither confirms an error.',
    example:
      'With an expected range of 0–10%, a value of 10% is within range and 11% is outside. A value can be within this range and still be unusual relative to the other observations.',
    detail:
      'The overall label prioritizes missing/invalid values, then range violations, extreme IQR outliers, other statistical outliers, and finally no statistical flags. All separate flags remain visible. “No statistical flags” does not mean every method was available or that the value is correct.',
  },
  {
    title: 'Sensitivity comparison',
    explanation:
      'Compare summaries using all valid values with summaries after temporarily excluding observations meeting any selected rule. Rules combine with OR, so an observation meeting several rules is counted once. Original thresholds and rows stay fixed.',
    formula:
      'Change = retained summary − full-data summary; percentage excluded = 100 × excluded valid rows / all valid rows.',
    example:
      'For 1, 2, 3, 4, 10, an expected maximum of 5 selects 10 for exploratory exclusion: 1 of 5 values (20%). Mean changes from 4 to 2.5 (−1.5); median from 3 to 2.5 (−0.5).',
    detail:
      'This shows how much selected observations affect your conclusions; it does not scientifically justify removing them. Missing/invalid values are never in the numerical denominator. If every valid value is excluded, retained summaries are unavailable.',
  },
  {
    title: 'Transformations, pseudocounts and processing order',
    explanation:
      'Choose a scale and where to apply it. Figures only keeps statistics and screening in original units. Analysis and figures transforms all valid values first, then recalculates summaries, quartiles, IQR/MAD and IQR/modified-Z flags on that scale. Original text is preserved, and expected bounds are always entered and checked in original units.',
    formula:
      'Log10: t = log10(value + c), with optional nonnegative pseudocount c (default 0). Standard z-score: t = (value − full-data mean) / full-data sample SD, with the n − 1 SD denominator.',
    example:
      'For 0, 9, 99 with pseudocount c = 1, log10(x + 1) gives 0, 1, 2. Transforming first gives mean 1; figures only places the original mean line at log10(36 + 1) ≈ 1.5682. For 1, 2, 3, mean = 2 and sample SD = 1, so z-scores are −1, 0, 1.',
    detail:
      'The pseudocount is added to every value, not only zeros, and has the original units. Choose it scientifically, report it and compare justified alternatives: it can strongly change near-zero distances and flags and does not fix errors or represent censored measurements automatically. Every x + c must be positive; undefined transformations block the selected view or analysis without dropping samples. Z-scores require at least two values and positive finite SD, differ from modified Z screening scores, and do not change distribution shape or usually these screening decisions. Transform first when proportional differences or multiplicative variation are meaningful; use figures only for readability with original-scale inference. Filter first only with justified criteria: save the original-scale audit, download retained original values, and paste them into a separate analysis to fit transformations there. Sensitivity exclusions alone keep transformation parameters and thresholds fixed to the full dataset. Figure-only lines and box summaries transform original statistics; upfront mode calculates them after transformation. Value axes identify log10(x + c) or unitless z-scores (y for point/distribution plots, x for histograms). Unrepresentable bounds are omitted with a notice; plausibility still uses original values. Histogram bins and violin density use the displayed values. Scaling can change apparent modality and does not guarantee normality.',
  },
  {
    title: 'Violin plots and smoothing',
    explanation:
      'A violin shows a smoothed estimate of the distribution. Wider sections indicate greater concentration of values. Each observation contributes a small Gaussian bell curve; their average gives the kernel density estimate (KDE). Individual observations remain visible beside the violin.',
    formula:
      'f(t) = sum exp(−0.5((t − x)/h)²) / (n h √(2π)); h = max[0.9 × A × n^(−1/5) × smoothing, observed range/100], where A = min(sample SD, IQR/1.34), or sample SD if IQR = 0.',
    example:
      'Two clusters near 2 and 8 may form two wide lobes with a narrow waist. Lower smoothing can separate nearby peaks; higher smoothing can merge them. Compare the histogram and individual points before interpreting groups.',
    detail:
      'The bandwidth h controls smoothing, with a default multiplier of 1 and choices from 0.25 to 2. The rule follows Silverman (1986), p. 48, eq. 3.31; type-7 quartiles are calculated on the displayed values. A range/100 floor bounds computation for large datasets and may prevent very fine peaks from appearing. The displayed contour stops at observed extrema; it is not boundary-corrected or renormalized there. Width is relative to the peak density, not counts. At least two distinct values are required; otherwise only points are shown. Peaks depend on scale, sample size and smoothing and do not demonstrate distinct populations, particularly for small or discrete datasets. Save the matching caption to record the actual bandwidth and scale.',
  },
  {
    title: 'Missing values and numerical limits',
    explanation:
      'Empty spreadsheet fields and NA, N/A, NaN, null, missing or a single dot are treated as missing. Other non-numbers, malformed rows, infinity and numbers outside supported numerical range are invalid. They remain in the table and exports but do not enter statistics.',
    example:
      'Four records containing 2, NA, “oops” and an empty value produce 1 valid number, 2 missing values and 1 invalid value. Empty lines are ignored; an empty field in an existing row is retained.',
    detail:
      'Decimal commas mean decimals only within unambiguous fields; thousands separators are unsupported. Original text is preserved. Calculations use double precision, so unusually long numbers receive precision warnings. Small, skewed, multimodal, dependent or discrete samples can make screening flags misleading; no method here determines whether an observation is truly incorrect.',
  },
];

// Reports and spreadsheets use the same explanations and examples as the interface.
export const methodText = methods.map(
  (method) =>
    [
      method.title,
      [
        method.explanation,
        'formula' in method ? method.formula : '',
        `Example: ${method.example}`,
        method.detail,
      ]
        .filter(Boolean)
        .join(' '),
    ] as const,
);
