# Citing RangeSieve and its methods

RangeSieve was created by **Annina R. Meyer**, [ORCID: 0009-0006-3110-6598](https://orcid.org/0009-0006-3110-6598), [@anninameyer](https://github.com/anninameyer).

## Cite the software

For version 1.0.0, use:

> Meyer, A. R. (2026). _RangeSieve: numerical data exploration and outlier review_ (Version 1.0.0) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23540904

The application’s **Cite RangeSieve** section provides the citation and a **Download software citation** button. You can also select **Cite this repository** on GitHub. Cite the version you used; the DOI above identifies v1.0.0 specifically.

## Report your analysis settings

In your methods or supplementary material, record:

- The RangeSieve version and the methods applied.
- The quartile convention (**Hyndman–Fan type 7**) and actual IQR multipliers or modified Z-score threshold used.
- Any expected minimum or maximum, with its scientific basis.
- The sensitivity criteria selected and any exclusions actually made, with their rationale.
- Any transformation (none, log10 or full-data mean/sample-SD z-score), its scope (figures only or before analysis), exact pseudocount, entered units, and violin bandwidth/smoothing. State whether screening preceded transformation or used transformed data; if filtering first, document both passes and the exclusion rationale. Retain the fitted mean/SD for z-scores.

**Download figure caption** records the figure settings, thresholds, method references and software citation. The analysis report and Excel citation sheets also retain citation information. Include captions, reports and annotated results in supplementary material where sharing is appropriate.

## Cite the methods you used

The [methods guide](METHODS.md) explains each calculation and its limitations. Cite the substantive methods used in your analysis, following your journal’s requirements.

| Method                    | Reference                                                                                                                                                                                                            | What to specify                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Quartiles and percentiles | Hyndman, R. J., & Fan, Y. (1996). _Sample Quantiles in Statistical Packages_. The American Statistician, 50(4), 361–365. [DOI](https://doi.org/10.1080/00031305.1996.10473566).                                      | Type 7; different quartile definitions can change flags.                                                                                    |
| IQR fences                | Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley. [NIST illustration](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm).                                                              | The mild and extreme multipliers. RangeSieve combines these fences with type-7 quartiles.                                                   |
| Modified Z-score          | Iglewicz, B., & Hoaglin, D. C. (1993). _How to Detect and Handle Outliers_. ASQC Quality Press. [NIST explanation](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm).                                | The 0.6745 scaling factor, chosen absolute-score cutoff and treatment of zero MAD.                                                          |
| MAD scaling               | [NIST Dataplot: Median Absolute Deviation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm).                                                                                              | The displayed MAD is unscaled; the modified Z-score applies the normal-consistency factor.                                                  |
| Violin density            | Silverman, B. W. (1986). _Density Estimation for Statistics and Data Analysis_. Chapman & Hall, p. 48, eq. 3.31. [Bandwidth documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/bandwidth.html). | Gaussian KDE; displayed scale, actual bandwidth and smoothing multiplier, zero-IQR fallback, range/100 floor and observed-range truncation. |

## Example manuscript statement

Adapt this example to your actual settings and analysis:

> Numerical observations were explored in RangeSieve v1.0.0. Quartiles used Hyndman–Fan type 7. Values outside Q1 − 1.5×IQR or Q3 + 1.5×IQR were flagged for review; extreme fences used 3×IQR. Modified Z-scores used 0.6745(x−median)/MAD and |M| > 3.5. Expected bounds were specified independently. Flags were treated as prompts for review, not evidence of error.

Add the actual expected bounds and any justified exclusions if applicable.

For transformed analyses, also state, for example: “All valid values were transformed as log10(x + 0.01), with 0.01 expressed in the original measurement units, before calculating summaries and statistical screening flags. Expected-range checks used original values. Sensitivity exclusions used fixed full-data thresholds and transformation parameters.” For figures only, explicitly say that statistics and screening used original data. A filter-first workflow should report the original-scale rules, removed records and a second analysis fitted to retained original values. The downloadable report and captions record the selected order and parameters; the two-column retained-values download is an input for the second analysis, so keep the first report and annotated dataset as its audit.

## Development acknowledgement

Software development was assisted by the large language model **GPT-6.1-Sol (high reasoning setting)**. Dataset analysis is performed by the local application code. The software citation credits Annina R. Meyer as the author.

## Figure acknowledgements

Figures use [Plotly.js v3.7.0](https://github.com/plotly/plotly.js/tree/v3.7.0). The default palette is adapted from Okabe and Ito’s [Color Universal Design](https://jfly.uni-koeln.de/color/), with symbols and line patterns supplementing color. Acknowledge these if your journal requires it. Custom colors should be checked for distinguishability in the final figure.

[Open RangeSieve](https://anninameyer.github.io/RangeSieve/) · [Quick start](README.md) · [Methods and limitations](METHODS.md)
