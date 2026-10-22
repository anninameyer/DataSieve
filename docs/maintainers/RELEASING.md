# Release maintenance

Maintainer reference. Researchers should use the [citation guide](../../CITING.md).

## Citation metadata

Keep `CITATION.cff` and `src/references.ts` consistent: title, version, release date, author, ORCID and version-specific DOI. Keep the citation in the user README and citation guide consistent with them. The shared citation is used by the interface, downloaded citation, summary exports, reports, Excel citation sheets and separate figure captions. Figures themselves remain unbranded.

The software title is **RangeSieve: numerical data exploration and outlier review**. Explain data handling in the description: pasted data is processed locally in temporary browser memory, with no dataset upload to external servers, external sharing, or automatic saving. Downloaded results are saved only when the researcher chooses to export them. Preserve the development acknowledgement for GPT-6.1-Sol (high reasoning setting); human authorship and software citations remain separate from that acknowledgement.

The confirmed author is **Annina R. Meyer**, ORCID `https://orcid.org/0009-0006-3110-6598`. The v1.0.0 release date is **2026-10-21** and its DOI is **10.5281/zenodo.23540904**. The concept DOI **10.5281/zenodo.23540903** covers all versions; use the version DOI when identifying software used for an analysis.

## Published record corrections

The project has been renamed to RangeSieve. Rename the existing GitHub repository to `RangeSieve` to preserve its history and repository identity. Update the local Git remote to `git@github.com:anninameyer/RangeSieve.git`, then choose **Sync now** in Zenodo’s GitHub settings and confirm the repository remains enabled with its existing release. The website URL is `https://anninameyer.github.io/RangeSieve/`; there is no redirect site at the previous Pages address.

Update the existing Zenodo record’s title to **RangeSieve: numerical data exploration and outlier review**, its description to use RangeSieve, and its repository link to `https://github.com/anninameyer/RangeSieve`. Keep its DOI, creator, ORCID, release date and version. Archived source files and the existing release tag retain their original snapshot.

Updating the repository does not automatically change an existing Zenodo record. Sign in to Zenodo, open [the v1.0.0 record](https://zenodo.org/records/23540904), choose **Edit**, update its descriptive metadata, and choose **Publish**. Metadata edits preserve the DOI and do not replace the archived source ZIP or GitHub release tag. A title correction alone does not require a new release. Follow [Zenodo’s record-editing guidance](https://help.zenodo.org/docs/deposit/manage-records/#edit-published-records).

## Future versions

Before publishing a new software version, update version labels and release dates consistently. The v1.0.0 DOI must not identify another version. For a version whose DOI is not yet available, remove the previous DOI from CFF and leave `SOFTWARE.doi` empty; ensure the interface displays an appropriate repository link until the new DOI is configured.

After successful checks, publish a new tagged GitHub release. The enabled Zenodo integration archives new releases. Check the resulting title, author, ORCID, version, license and files, then add its actual version DOI to the metadata and rebuild the application. Previously downloaded offline files retain their bundled citation until replaced with a fresh download.

GitHub source archives exclude the ignored `offline/` build. The ready-to-use offline HTML is distributed through the application’s download button. Confirm the files actually included in any archive before describing it as a standalone application distribution.

Use `CITATION.cff` as the metadata source. If `.zenodo.json` is added, Zenodo uses it instead of CFF; avoid conflicting copies. See [CFF support](https://help.zenodo.org/docs/github/describe-software/citation-file/) and [release archiving](https://help.zenodo.org/docs/github/archive-software/github-upload/).
