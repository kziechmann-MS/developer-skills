# Performance Evidence Report

Use only applicable rows and mark omissions. Keep raw artifacts in their
approved storage location; link or identify them without copying sensitive
content into the report.

## Question and metric contract

- Regression or opportunity:
- Primary metric, start and end:
- Custom readiness prerequisites:
- Related FCP/LCP/CLS/TBT/INP definitions:
- Required visible/functional state:
- Success threshold and unacceptable tradeoffs:

## Provenance

| Candidate | Source/build artifact | Config/experiment | Route/render mode | Device/runtime | Cache/network | Matched? |
|---|---|---|---|---|---|---|
| Control | | | | | | |
| Treatment | | | | | | |

State every known mismatch and its effect on causal interpretation.

## Hypothesis

- Proposed critical prerequisite:
- Proposed intervention:
- Expected timeline change:
- Falsifying observation:

## Per-run evidence

Keep one row per run. Do not mix summary/footer rows into this table.

| Run ID | Candidate | Outcome | Readiness | FCP | LCP + candidate | CLS | TBT/long tasks | INP | Requests/cache | Artifact |
|---|---|---|---:|---:|---|---:|---|---:|---|---|
| | | | | | | | | | | |

Summaries: sample count, median, distribution/range and predeclared exclusions.
List errors, retries and outliers with their candidate identity.

## Chronological timeline

| Time / range | Thread/resource | Event | Dependency or contention | Evidence |
|---|---|---|---|---|
| | | | | |

Include discovery/download, parse/eval, registration, initialization, data,
construction, readiness, tasks/microtasks/frames, paints and long tasks.

## Critical-path conclusion

- Last prerequisite for readiness:
- Last prerequisite for LCP or target paint:
- Awaited work:
- Concurrent/contending work:
- Consumer fallback or duplicate work:
- Unknowns:

## Tradeoffs

| Dimension | Control | Treatment | Interpretation |
|---|---|---|---|
| Readiness and visible primary content | | | |
| LCP candidate/repaint | | | |
| CLS | | | |
| TBT/long tasks/interaction | | | |
| Optional content and navigation | | | |
| Failure/retry behavior | | | |
| Request count/cache identity | | | |

## Scenario matrix

| Scenario/config source | OFF/control | ON/treatment | Ineligible | Coverage/evidence |
|---|---|---|---|---|
| Initial client render | | | | |
| Server/prerendered load | | | | |
| Client navigation | | | | |
| Alternate composition/mode | | | | |
| Hidden/restored document | | | | |
| Failure/retry | | | | |
| Rapid/stale navigation | | | | |

## Ownership options

| Option | Policy/mechanics owner | Dependency impact | Benefits | Risks |
|---|---|---|---|---|
| | | | | |

## Recommendation, risk and rollback

- Recommended option and why:
- Default/OFF behavior:
- Eligibility boundary:
- Main risks:
- Rollback:
- Blockers attributed elsewhere:

## Exact validation plan

- Focused tests:
- OFF/ON/ineligible tests:
- Affected build/lint/type/dependency checks:
- Import/circular edge-set comparison:
- Matched browser or other runtime runs:
- Evidence not run and why:

## Claims and limitations

For each conclusion, state its source, whether the comparison is matched, its
coverage label (`executed`, `analogous/partial`, `rubric-only`, `unexecuted`),
and what remains unverified. Separate unrelated regressions and third-party or
platform blockers from the recommendation.
