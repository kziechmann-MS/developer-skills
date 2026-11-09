# Contracts and lifecycle checks

Load when choosing boundaries or a failure matrix; adapt to existing application
contracts rather than introducing an unnecessary renderer framework.

## Capability and authority ledger

| Boundary | Contract and check | Authority that must remain outside model output |
|---|---|---|
| Prompt -> model | Minimal approved context, output shape, available capabilities | Data-access and disclosure permissions |
| Model -> tool dispatcher | Allowlisted tool, bounded arguments, known entity references | Trusted server auth/tenant, per-call policy, destination allowlist |
| Tool -> shaping | Bounded validated domain data, explicit failure | Eligibility, prices, ownership, permissions and calculations |
| Shaping -> UI document | Supported version, semantic IDs, safe values and supported actions | Which capability is actually offered |
| UI document -> registry | Exact allowed component/action names, validated props | Trusted code and safe rendering sinks |
| Client -> action endpoint | Current request/revision/component, strict arguments | Current principal, resource access and write authorization |
| Action -> domain effect | Idempotency and transaction/concurrency policy | Durable storage and current business constraints |

Checking structure does not prove a record is visible to the user. Offering a
button does not authorize the click. An authorization check when generating the
document does not replace one when executing an action.

Keep generated content separate from executable behavior. Avoid eval, dynamic
imports from output, model-authored event handlers and unreviewed navigation.
Treat retrieved text as data even if it contains command-like instructions.
Use framework escaping or `textContent` for plain text; do not generalize that
to safe rich HTML or arbitrary URL handling.

## Lifecycle matrix

| State/transition | Expected behavior | Failure probe |
|---|---|---|
| Loading | Correlated request, explicit activity, defined old-content policy | Start a second request before the first resolves |
| Loading suspension -> dispatch | Recheck cancellation, deadline and current-request applicability immediately before invoking the adapter | Consume loading, cancel/supersede/expire while suspended, resume and assert zero adapter invocations |
| Partial | Status or validated bounded snapshot; no executable fragments | Stop halfway through JSON |
| Ready | Validated version/capabilities and authoritative data | Invent availability or an unknown event ID |
| Invalid/unsupported | Diagnostic and explicit non-success outcome | Malformed JSON, duplicate IDs, unknown version/component/action |
| Refused | Distinct visible refusal; no blind retry | Refusal after some partial content |
| Error/timeout | Sanitized code; bounded waiting; no fabricated result | Provider throws or never completes |
| Cancelled | Local work invalidated; late completion cannot render/act | Cancel while a next-chunk promise is pending |
| Stale | Old request/revision/sequence cannot replace current content | Deliver old ready response last |
| Disposed | Owned listeners/work cleaned up; no new DOM effects | Complete after unmount |
| Action/retry | Reauthorize; maintain defined idempotency | Forged capability, principal mismatch, stale request, duplicate write |

An atomic-commit strategy deliberately does not render partial components.
If the product requires incremental components, specify validated operation or
snapshot semantics, out-of-order delivery, deletion, reference integrity and
action eligibility for each revision. Do not advertise one strategy as proof of
the other.

## Bounded work

Use a task-sized limit ledger: model calls, tool calls, output bytes/characters,
document node count, tool results, elapsed time, retries and concurrent work.
Explicitly say which limits the adapter/provider actually enforces. A local
timeout can end waiting while a remote provider continues work. Transport abort,
provider cancellation, billing controls and durable action idempotency need
separate production integration checks.

## Version and evidence rules

Inspect the project's manifest and lockfile, then consult matching official
documentation before using provider/framework APIs. If only newer documentation
is available, record the mismatch and avoid guessing. Do not install an SDK to
resolve a documentation ambiguity.

These are portable implementation checks, complementary to existing generative
UI libraries, not a claim that catalogs or streaming are novel. Provider model
quality, prompt robustness, live network cancellation, accessibility, distributed
transactions, deployment and security review require independent evidence.
