# Offline event-board example

Fictional community events; no packages, network services or production data.
Requires Node 22 or later. From the repository root on Windows:

```powershell
node --test .\api-to-ui-feature-integration\examples\event-board.test.mjs
```

`event-board.mjs` contains a preselecting service, explicit optional-config
adapter, state owner, delayed host registry and DOM renderer. The page enables
accessibility prioritization; the sidebar omits it. The service, not a client
sort, chooses from the full candidate set. Saved responses and incremental
batches reuse the validated projection. Batch merge replaces existing IDs in
place and appends new IDs; it is not a network streaming protocol.

## Frozen acceptance criteria

| Test | Required observation |
|---|---|
| Two callers | Page forwards `true` and selects `event-garden`; sidebar omits the option and selects `event-river` |
| Forwarding negative control | The same selection predicate fails when an intentionally broken test-only boundary strips the option |
| Late registration | No render before readiness; current result renders once with exact emitted event/placement IDs |
| Superseded/disposed work | Controlled late completion cannot render or emit |
| Stored/incremental | Stable IDs, changed title, new event and duplicate rejection through the owner |
| Invalid data/config | Explicit error and sanitized diagnostic, no successful empty result |
| False/re-registration | Default policy is preserved and registration alone does not re-emit |
| Repeated failure/in-flight work | Diagnostics describe the current failure and invalid incremental work cannot be overwritten by an older pending load |

These are application boundary checks, not agent reasoning scores or a
with/without-skill comparison. The negative control is a deliberately defective
adapter, not an unassisted agent.

The optional shared browser check in `checks` exercises the exported renderer
against real DOM nodes. Node tests use observable render callbacks and do not
alone prove DOM behavior. No framework, production transport, persistent
storage, real stream assembly, telemetry ingestion, accessibility certification
or performance claim is covered.

## Execution status

See the repository README for the latest commands actually executed. Authored
cases in `evaluations.json` remain a rubric unless separately run as agent tasks.
