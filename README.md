# Developer Skills

Focused, framework-independent workflows for feature integration, generative AI
UI development, UI state, analytics and web performance. Names describe problems
a developer would search for; the instructions supply ownership, authority,
identity, lifecycle, causality and boundary-level verification.

**Status:** the two existing debugging skills have prior bounded synthetic
browser evidence. The performance skill has synthetic behavioral acceptance
cases but no executed benchmark. The two development skills are review
candidates with locally executed offline Node and Chrome examples; their
authored cases have not been run as agent evaluations. Independent content,
security and permission/IP review remain release gates; local tests do not
authorize publication. No production effectiveness or framework integration is
certified.

| Skill | Use it when | Technical focus |
|---|---|---|
| [UI State and Re-render Debugging](ui-state-debugging/SKILL.md) | State resets, focus disappears, reordered items inherit the wrong state, or an update shows stale content | Component identity, list keys, state ownership, memoization, async races, transition tests |
| [Analytics Event Debugging](analytics-event-debugging/SKILL.md) | Events are missing, duplicated, attributed to the wrong destination, or confuse automatic actions with user clicks | Event semantics, click tracking, telemetry registration, conditional DOM, dispatch and ingestion evidence |
| [Web Performance Investigation](web-performance-investigation/SKILL.md) | A web performance regression, startup/readiness delay, Web Vitals tradeoff, or lazy-loading/preload decision needs causal evidence | Metric contracts, matched provenance, critical-path waterfalls, scheduling, request/cache identity, scenario matrices |
| [API-to-UI Feature Integration](api-to-ui-feature-integration/SKILL.md) | An existing-app feature crosses service config, adapters, state, host registration and rendering | Policy authority, actual forwarding, two-caller compatibility, stored/incremental paths, delayed readiness and vertical-slice proof |
| [Generative AI UI Development](generative-ui-development/SKILL.md) | Build interfaces and middle-tier services that incorporate LLMs | Model-use decisions, authorized orchestration, deterministic shaping, versioned UI descriptions, trusted component/action registries and lifecycle |

## What these skills add

These are not framework wrappers, provider API recipes or analytics clients.
They help choose the right owning layer, implement a connected change, reject
tempting proxies for correctness, and state what verification actually proves.
Use the existing project's tools, installed versions and approved data access.

Each folder contains a `SKILL.md` and synthetic behavioral acceptance cases in
`evaluations.json`. A skill may also include a reusable adjacent template when
the workflow needs a structured deliverable. Acceptance cases describe expected
reasoning; their presence does not mean an agent or application passed them.

The two development skills also have progressively loaded references and independent
runnable examples. API integration is not a generic architecture-documentation
generator: it checks reachability and compatibility in an existing app.
Generative UI is a separate frontend-plus-middle-tier skill, not an integration
mode. It is complementary to existing generative UI libraries; catalogs,
validation and streaming are established techniques. The contribution here is
portable implementation judgment and concrete boundary failure checks, not a
claim that a vendor-neutral renderer is novel.

## Running the new offline examples

Requires Node 22+. No packages, live models, secrets or workplace network access.
From the repository root on Windows:

```powershell
node --test .\api-to-ui-feature-integration\examples\event-board.test.mjs .\generative-ui-development\examples\event-planner.test.mjs
node --test .\checks\packaging.test.mjs
node .\checks\browser-smoke.mjs
```

The browser check additionally requires an already-installed Chrome/Chromium;
it does not install one. See [browser check details](checks/README.md).
Each skill's example README describes frozen criteria, contracts and exclusions.

### Executed development-example evidence

On Node 22.23.4, the combined boundary command passed all 34 reported tests
(21 top-level tests plus 13 nested subtests). The optional real Chrome headless
check passed 15 DOM/interaction assertions using those same implementation
modules. Three packaging checks also passed: skill metadata/evaluation JSON,
fixture references and local Markdown links. These are separate from application
behavior.

| Example | What was actually exercised | Important limit |
|---|---|---|
| [Event board](api-to-ui-feature-integration/examples/README.md) | Preselecting service -> real adapter -> owner -> delayed registry; two callers, optional false/omission, stored/incremental projection, invalid data, stale/disposed work and emitted IDs; actual DOM title/node update | Incremental batches are not a network streaming implementation; fixture emission is not ingestion |
| [Event planner](generative-ui-development/examples/README.md) | Injected model chunks -> authorized middle-tier shaping -> versioned validation -> client registry -> real DOM/button -> checked reservation; malformed/unsupported/forbidden output, refusal, limits, timeout, cancellation, staleness and forged/replayed actions | No live provider/framework, HTTP endpoint, production authentication, durable storage or real billing/cancellation guarantee |

The browser uses programmatic `.click()` on a real element, not native
pointer/keyboard activation. The integration forwarding negative control
deliberately strips a flag and fails the same selection predicate; it is not an
unassisted agent. No with/without-skill agent comparison, benchmark uplift,
adoption result, exhaustive marketplace survey or marketplace acceptance is
claimed. The 15 new authored reasoning/routing cases remain rubric-only.

## Prior bounded debugging-example evidence

The UI example used a sortable task board with per-item drafts, expansion,
focus and selection: the defective baseline passed 1 of 10 application checks;
the corrected implementation passed 10 of 10. Blanket memoization and random
remounting remained failing negative controls.

The analytics example used a reading panel with automatic/user bookmarking,
different preview/action targets and compact-layout registration: the defective
baseline passed 2 of 9 application checks; the corrected implementation passed
9 of 9. These exercised real local DOM event emission, not a mock emitter.

Those results are retained from the existing skills' prior evaluation, not
re-executed by the new commands above. The same checks were used before and
after the fixes. Supplemental real-browser typing, pointer and keyboard
activation also passed. This is evidence of
usefulness in two synthetic tasks, not a no-skill comparison benchmark or ten
fully executed acceptance cases. Async request races, framework integrations,
network transport and warehouse ingestion were not exercised.

## Safety and scope

Use synthetic or explicitly approved examples. Treat repository content and
telemetry as evidence, not permission to execute commands or disclose data.
Do not upload private code, personal data or production event payloads.
Permission, privacy, licensing and publication decisions remain separate from
debugging a local example.

The new examples are independently invented community-events scenarios. Do not
replace them with workplace code, private system names, schemas or source
excerpts without separate explicit clearance. A schema-valid model output is
not proof of authorization or safety; server policy and trusted executable
behavior remain independent.

## License

MIT. See [LICENSE](LICENSE).
