# RangeSieve

**[Open RangeSieve →](https://anninameyer.github.io/RangeSieve/)**

RangeSieve helps explore numerical datasets, identify unusual observations, and assess whether values fall within an expected range. No installation, account, or programming is needed.

- Explore interactive histograms, boxplots, violin plots, and sorted observations, with optional log10 or z-score display scaling.
- Review potential outliers and compare how selected exclusions affect summary statistics.
- Export tables as CSV, TSV, or Excel, and figures as PNG, TIFF, PDF, or SVG.

## Get started

1. **[Open the application](https://anninameyer.github.io/RangeSieve/)** and select **Try an example**, or paste two columns copied from Excel or a CSV/TSV file: sample identifiers and numerical values.
2. Check the input preview and select **Analyze dataset**.
3. Explore the results, adjust thresholds or expected bounds, and download your tables and figures.

## Use offline

Select **Download offline edition** in the application’s sidebar. Save `RangeSieve.html` and open it in your browser whenever you need it, including without an internet connection.

## Local processing and data handling

Paste your data and run the analysis in your browser. Your dataset is held temporarily in browser memory: RangeSieve does not upload it to external servers, share it with third parties, or save the analysis automatically. Results are saved to your device only when you choose to download them. Reloading or closing the application clears the analysis.

## Methods and citation

Outlier flags are prompts for review, not proof of an error. Use study context and domain expertise when deciding whether to exclude observations. See [Methods and limitations](METHODS.md) for explanations and references.

Created by **Annina R. Meyer** ([ORCID](https://orcid.org/0009-0006-3110-6598), [@anninameyer](https://github.com/anninameyer)). If you use RangeSieve, please cite the software version and methods you used:

> Meyer, A. R. (2026). _RangeSieve: numerical data exploration and outlier review_ (Version 1.0.0) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23540904

See [citation guidance](CITING.md) or select **Cite this repository** on GitHub.

Software development was assisted by the large language model **GPT-6.1-Sol (high reasoning setting)**. Dataset analysis is performed by the local application code.

Free to use under the [MIT license](LICENSE).
