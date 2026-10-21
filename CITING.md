# Citing DataSieve and its methods

## Credit for the software

DataSieve was created by **Annina R. Meyer**, [ORCID: 0009-0006-3110-6598](https://orcid.org/0009-0006-3110-6598), [@anninameyer](https://github.com/anninameyer). The interface, report, figure captions, and Excel workbooks use this publication name. The repository’s [CITATION.cff](CITATION.cff) records the author name and ORCID for GitHub’s **Cite this repository** feature and Zenodo’s release metadata.

Cite the archived release as:

> Meyer, A. R. (2026). _DataSieve: numerical data exploration and outlier review_ (Version 1.0.0) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23540904

Record the software version, applied methods, actual thresholds, quartile convention, domain bounds, and any justified exclusions. A figure caption records these settings; it is not scientific justification for excluding observations. Supplementary material can include the figure, caption, analysis report, and annotated data where sharing is appropriate.

## Archived release

DataSieve v1.0.0 was published on **21 October 2026**. Its version-specific DOI is **[10.5281/zenodo.23540904](https://doi.org/10.5281/zenodo.23540904)**. The [concept DOI](https://doi.org/10.5281/zenodo.23540903) covers the project across versions; use the version-specific DOI to identify the software used in an analysis.

The title is **DataSieve: numerical data exploration and outlier review**. Privacy belongs in the description: all analysis runs in the researcher’s browser, with no research data uploaded or stored by DataSieve. The online and self-contained offline editions share the same application code.

`CITATION.cff` and `src/references.ts` record the same title, author, publication date, version, and DOI. The interface, downloadable citation, reports, Excel citation sheets, and separate figure captions use the shared citation. Exported figures retain their unbranded artwork and metadata.

## Correcting the published Zenodo title

Repository updates do not automatically change an existing Zenodo record. Sign in to Zenodo and open [the v1.0.0 record](https://zenodo.org/records/23540904), select **Edit**, change the title to **DataSieve: numerical data exploration and outlier review**, and put the privacy explanation in the description. Keep the author, ORCID, version, publication date, and DOI. Select **Publish** to apply the metadata changes. Zenodo’s [record-editing instructions](https://help.zenodo.org/docs/deposit/manage-records/#edit-published-records) explain that this preserves the DOI.

Editing the record’s metadata does not modify its archived source ZIP or the existing GitHub release tag. There is no need for a new release just to correct the title. Previously downloaded application files retain their bundled citation; download the updated offline edition from the website to use the corrected citation.

## Future releases

Keep the publication name **Annina R. Meyer**, [ORCID: 0009-0006-3110-6598](https://orcid.org/0009-0006-3110-6598), consistent in the citation metadata. Before a new software release, update the version and release date and remove the previous version’s DOI from the metadata until the new version DOI is available. Do not assign the v1.0.0 DOI to another version.

After successful checks, publish a new tagged GitHub release. The enabled Zenodo integration archives new releases; check the resulting title, author, ORCID, version, license, and files, then add the actual version DOI to the citation metadata and rebuilt application. GitHub source archives exclude the ignored `offline/` build; the ready-to-use offline HTML is distributed through the application’s download button.

Use `CITATION.cff` as the metadata source. If `.zenodo.json` is added, Zenodo uses it instead of CFF, so avoid conflicting copies. See Zenodo’s [CFF support](https://help.zenodo.org/docs/github/describe-software/citation-file/) and [release-archiving instructions](https://help.zenodo.org/docs/github/archive-software/github-upload/).

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
