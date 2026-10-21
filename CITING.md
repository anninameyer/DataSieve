# Citing DataSieve and its methods

## Credit for the software

The interface, report, figure captions, and Excel workbooks credit [@anninameyer](https://github.com/anninameyer). The repository includes [CITATION.cff](CITATION.cff), which enables GitHub’s **Cite this repository** feature once pushed. The current metadata uses the verified GitHub handle; substitute the creator’s confirmed publication name and optional ORCID when available. No author identity, DOI, release date, or affiliation is invented.

Before a DOI exists, users can cite:

> anninameyer. _DataSieve_ (version 1.0.0) [Computer software]. https://github.com/anninameyer/DataSieve

Record the software version, applied methods, actual thresholds, quartile convention, domain bounds, and any justified exclusions. A figure caption records these settings; it is not scientific justification for excluding observations. Supplementary material can include the figure, caption, analysis report, and annotated data where sharing is appropriate.

## Recommended: archive releases with Zenodo

Yes: a DOI-backed archive gives the software a persistent, citable record under its creator’s name. This does **not** require submitting research data. Only publish the software, synthetic examples, documentation, and prepared application builds.

1. Confirm the creator’s publication name and ORCID in `CITATION.cff` and `src/references.ts`. For a person, use `given-names` and `family-names` in CFF; do not add an unverified affiliation.
2. Sign in to Zenodo, link GitHub, and enable `anninameyer/DataSieve` in the GitHub integration. This is an owner action; the app does not connect to Zenodo.
3. Ensure all checks pass, then create a tagged GitHub release, for example `v1.0.0`. New releases after integration is enabled are archived. Check the resulting Zenodo record and creator order, version, MIT license, title, description, and software resource type.
4. Confirm which files were archived. GitHub source archives do not contain the ignored `offline/` build. If distributing the single HTML through Zenodo, include the tested `DataSieve.html` in the deposition using the supported Zenodo workflow, or create a manual software deposition containing source and build. Avoid creating competing records for the same release.
5. Use the resulting **version-specific DOI** in citations for an analysis. Zenodo also supplies a **concept DOI** covering all versions; this suits a general project link rather than identifying the exact version used.
6. Add the actual version DOI to CFF (`doi:`) and `SOFTWARE.doi` in `src/references.ts`; rebuild the distributed editions. Update the existing archive’s descriptive metadata as appropriate. Never invent a DOI or a publication date. New code changes belong to a new version/release.

The app uses the DOI once configured and otherwise links the repository. It shows an honest pre-DOI citation. Adding citation metadata locally does not publish a record, mint a DOI, or connect your accounts.

Use one metadata source for Zenodo: if `.zenodo.json` is also present, Zenodo gives it priority over `CITATION.cff`. This repository intentionally uses CFF alone.

Official guidance: [Enable a repository](https://help.zenodo.org/docs/github/enable-repository/), [CFF metadata support](https://help.zenodo.org/docs/github/describe-software/citation-file/), [GitHub citation files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files), [version DOI versus concept DOI](https://zenodo.org/help/versioning).

## Which methods should a manuscript cite?

Cite the software for the implementation used, and cite the substantive methods applied. Hyndman–Fan type 7 is a defined quantile convention, so citing the original paper is appropriate when reporting that choice. There is no need to cite R as software: DataSieve implements the calculations directly and does not execute R. R’s documentation is a useful cross-check of the convention, not evidence that R ran the analysis.

| Applied component         | Reference and purpose                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quartiles and percentiles | Hyndman, R. J., & Fan, Y. (1996). _Sample Quantiles in Statistical Packages_. The American Statistician, 50(4), 361–365. [DOI: 10.1080/00031305.1996.10473566](https://doi.org/10.1080/00031305.1996.10473566). State **type 7**, since different definitions can change flags.                                             |
| IQR fences                | Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley. [NIST fence illustration](https://www.itl.nist.gov/div898/handbook/prc/section1/prc16.htm). DataSieve uses this screening convention with type-7 quartiles, not Tukey hinges.                                                                             |
| Modified Z-score          | Iglewicz, B., & Hoaglin, D. C. (1993). _How to Detect and Handle Outliers_. ASQC Quality Press. [NIST explanation](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm). State the chosen cutoff and treatment of zero MAD.                                                                                    |
| MAD scaling               | [NIST Dataplot: Median Absolute Deviation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm). The constant 0.6745 approximates Φ⁻¹(0.75); for normal data, raw MAD ≈ 0.67449 × population SD.                                                                                                     |
| Figure design             | Okabe, M., & Ito, K. [Color Universal Design](https://jfly.uni-koeln.de/color/). Credit the palette in software documentation; manuscript reference requirements depend on the journal. Shapes and line styles supplement color. No palette guarantees identical distinguishability for every viewer or printing condition. |
| Figure software           | Plotly, Inc. [Plotly.js v3.7.0](https://github.com/plotly/plotly.js/tree/v3.7.0). Acknowledge the visualization software where journal policy calls for it.                                                                                                                                                                 |

An example methods sentence (replace settings to match the actual analysis):

> Numerical observations were explored in DataSieve v1.0.0. Quartiles used Hyndman–Fan type 7. Values outside Q1 − 1.5×IQR or Q3 + 1.5×IQR were flagged for review; extreme fences used 3×IQR. Modified Z-scores used 0.6745(x−median)/MAD and |M| > 3.5. Domain bounds were specified independently. Flags were treated as prompts for review, not evidence of error.

For the software’s own documentation, keep the above method citations, Plotly version, palette attribution, and dependency license notices. A scientific citation and a dependency’s license notice serve different purposes. Downstream researchers generally need the tool and methods they used, not a reference-list entry for every interface/build dependency; follow the journal’s instructions. React, Vite, and fflate are documented technical dependencies with retained license notices.
