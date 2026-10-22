RangeSieve — Application Specification

1. Project overview

RangeSieve is a browser-based application for exploring numerical datasets, identifying statistical outliers, and evaluating potentially implausible observations.

It is designed primarily for scientific researchers working with experimental, observational, and citizen-science datasets.

The application must be accessible to users without programming knowledge.

Core principles

1. Local processing: datasets are processed in the browser without uploads to external servers, external sharing, or automatic saving.
2. No installation required for online usage.
3. Fully functional offline version distributed as a single HTML file.
4. Transparent and reproducible statistical methods.
5. Statistical outliers must not automatically be classified as incorrect observations.
6. Simple, intuitive interface with interactive visualizations.
7. No server-side processing, databases, authentication, or data collection.

2. Technology

Use:

* TypeScript
* React
* Vite
* Plotly.js for interactive visualizations
* A lightweight statistical implementation in TypeScript
* Vitest for automated testing
* Playwright for end-to-end testing

Use a modern, clean, responsive interface.

Avoid unnecessary dependencies.

The same application code must produce:

1. A static website suitable for GitHub Pages.
2. A self-contained HTML file named RangeSieve.html.

The offline file must contain all required JavaScript, CSS, and other assets.

It must work when opened directly using the file:// protocol, without an internet connection.

3. Data input

3.1 Paste data

Provide a large text input area where users can paste numerical data copied directly from Excel, Google Sheets, or another spreadsheet application.

Expected format:

Sample_ID    Salt_percentage
S001         2.5
S002         3.1
S003         2.8
S004         80.0

The application must:

* Detect tab-separated data.
* Support optional column headers.
* Support CSV input.
* Recognize sample identifiers and numerical values.
* Allow users to select the identifier and numerical value columns if necessary.
* Preserve the original sample identifiers.
* Accept integer and decimal values.
* Handle negative values.
* Handle missing observations.
* Identify non-numerical entries.
* Support decimal commas when unambiguous.
* Report parsing issues without silently modifying values.

Users must be able to paste a new dataset and immediately repeat the analysis.

3.2 Optional variable information

Allow users to specify:

* Variable name
* Measurement unit
* Expected minimum
* Expected maximum

The expected range is optional.

If only one boundary is known, users should be able to specify that boundary independently.

3.3 Example dataset

Provide a built-in example dataset containing:

* Typical observations
* Mild statistical outliers
* Extreme statistical outliers
* Values outside an example plausible range
* Missing values
* Non-numerical entries

The example must be clearly identified as synthetic data.

4. Descriptive statistics

Calculate and display:

* Total number of input rows
* Number of valid numerical observations
* Number of missing values
* Number of non-numerical values
* Mean
* Median
* Standard deviation
* Minimum
* Maximum
* Q1
* Q3
* Interquartile range
* 1st percentile
* 5th percentile
* 95th percentile
* 99th percentile

Use clearly documented quantile definitions.

Display the statistics in a compact dashboard.

5. Statistical outlier detection

Implement several complementary approaches.

5.1 IQR method

Calculate:

IQR = Q3 − Q1

Flag observations outside:

Mild outlier boundaries:

* Q1 − 1.5 × IQR
* Q3 + 1.5 × IQR

Extreme outlier boundaries:

* Q1 − 3 × IQR
* Q3 + 3 × IQR

Allow users to adjust the multipliers.

5.2 Modified Z-score

Calculate:

M = 0.6745 × (x − median) / MAD

where MAD is the median absolute deviation from the median.

Use |M| > 3.5 as the default threshold.

Allow users to adjust this threshold.

Handle zero MAD explicitly without generating invalid or misleading results.

5.3 Plausibility range

If users specify an expected range, identify observations outside those boundaries.

Distinguish these from statistical outliers.

The application must never assume that a statistical outlier is necessarily a reporting error.

5.4 Classification

Assign separate indicators for:

* Within the specified plausible range
* Outside the specified plausible range
* IQR outlier
* Extreme IQR outlier
* Modified Z-score outlier
* Missing or invalid numerical value

Allow multiple flags per observation.

Display an overall review priority, but do not equate statistical extremeness with confirmed error.

Suggested categories:

* No statistical flags
* Statistical outlier
* Extreme statistical outlier
* Outside expected range
* Invalid or missing value

These classifications must be clearly explained.

6. Interactive visualizations

Use Plotly.js.

6.1 Histogram

Display the numerical distribution.

Features:

* Adjustable number of bins
* Median reference line
* Optional mean reference line
* Optional plausible-range boundaries
* Optional IQR outlier boundaries
* Interactive hover information
* Ability to zoom and reset axes

6.2 Boxplot

Display:

* Boxplot with individual observations
* Outlier highlighting
* Sample identifiers on hover
* Optional plausible-range boundaries

6.3 Sorted observation plot

Create a scatterplot showing all observations sorted by numerical value.

Features:

* X-axis: observations ordered by value
* Y-axis: numerical value
* Hover: sample identifier and value
* Different colors for outlier classifications
* Optional plausible-range boundaries

This visualization should make it easy to identify which individual observations require closer inspection.

7. Interactive results table

Display a table containing:

* Sample identifier
* Original numerical value
* IQR classification
* Modified Z-score
* Plausibility-range classification
* Overall review classification

Allow users to:

* Sort by numerical value
* Sort by review classification
* Filter flagged observations
* Search by sample identifier
* Inspect all observations

Never automatically remove observations from the original dataset.

8. Sensitivity analysis

Provide a section comparing descriptive statistics:

1. Using all valid numerical observations.
2. Excluding observations selected by the user.

Allow users to choose exclusion criteria:

* Outside plausible range
* Extreme IQR outliers
* All IQR outliers
* Modified Z-score outliers
* Any selected combination

Show a comparison table including:

* Number of observations
* Mean
* Median
* Standard deviation
* Minimum
* Maximum

Also show:

* Number excluded
* Percentage excluded
* Change in mean
* Change in median

The application must clearly distinguish between exploratory exclusion and scientifically justified data cleaning.

9. Export functionality

Allow users to download:

9.1 Complete annotated dataset

CSV containing:

* Original sample identifier
* Original value
* All statistical flags
* Review classification
* Whether excluded in the sensitivity analysis

9.2 Flagged observations

CSV containing only observations requiring review.

9.3 Statistical summary

CSV containing descriptive statistics and relevant outlier thresholds.

9.4 Analysis report

Provide a downloadable HTML report containing:

* Variable information
* Number of observations
* Descriptive statistics
* Statistical thresholds
* Number of flagged observations
* Sensitivity analysis results
* Methodological explanations

All exports must be generated locally in the browser.

10. Privacy and security

This is a critical requirement.

* No user data may be uploaded to any server.
* No backend or database.
* No analytics or tracking.
* No external APIs.
* No cookies.
* No localStorage.
* No sessionStorage.
* No IndexedDB.
* No telemetry.
* No third-party resources loaded at runtime.
* No persistence of research data.
* No network requests containing user data.

All dependencies must be bundled locally.

Refreshing or closing the application must clear the entered data.

The online application must provide a privacy notice:

“Pasted data is processed locally in your browser. RangeSieve does not upload it to external servers, share it with third parties, or save your analysis automatically.”

The offline application must work without any network connection.

Implement automated tests verifying that pasted data does not trigger network requests.

11. User interface

Design a clean, modern scientific dashboard.

Suggested workflow:

1. Paste Data
2. Explore Distributions
3. Identify Outliers
4. Compare Statistics
5. Export Results

Use a restrained visual design with accessible colors and clear typography.

Avoid unnecessary complexity.

The application should be usable on desktop and tablet screens.

Provide contextual explanations for statistical methods.

Clearly distinguish between:

* Statistical extremeness
* Plausibility violations
* Confirmed reporting errors

The application must not claim to determine whether observations are truly incorrect.

12. Documentation

Create:

README.md

Include:

* Project description
* Features
* Privacy principles
* Local development instructions
* GitHub Pages deployment instructions
* Offline HTML instructions
* Statistical methodology
* Limitations
* Licensing information

Also create:

METHODS.md

Document:

* Mathematical definitions
* Quantile calculation method
* IQR detection
* Modified Z-score calculation
* Plausibility-range evaluation
* Missing-value handling
* Sensitivity analysis
* Limitations of automated outlier identification

13. Testing

Include automated tests for:

* Standard numerical datasets
* Small sample sizes
* Identical values
* Zero MAD
* Negative values
* Missing observations
* Non-numerical values
* Duplicate sample identifiers
* Decimal comma parsing
* Extreme numerical values
* Empty datasets
* Sensitivity-analysis calculations
* CSV export correctness
* Offline operation
* No network transmission of user data

Tests should use synthetic data only.

14. Deployment

Configure GitHub Actions to:

1. Install dependencies.
2. Run tests.
3. Build the production application.
4. Generate the standalone offline HTML file.
5. Deploy the online application to GitHub Pages.
6. Make the offline HTML file available as a downloadable artifact or release asset.

The offline and online versions must be generated from the same source code.

Ensure the GitHub Pages application works correctly under a repository subpath such as /RangeSieve/.

15. Acceptance criteria

The project is complete when:

* Users can open the hosted application without installation.
* Users can paste spreadsheet data and obtain results.
* All statistical calculations work correctly.
* Interactive visualizations display observations and their identifiers.
* Users can identify statistical outliers and plausibility violations.
* Users can compare statistics before and after excluding flagged observations.
* Users can export annotated data and analysis summaries.
* No research data is transmitted or persistently stored.
* The offline HTML version works without internet access.
* The online and offline versions provide equivalent functionality.
* All automated tests pass.
* The application is documented and ready for public use.
