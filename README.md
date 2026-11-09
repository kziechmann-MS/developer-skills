# Developer Skills

Focused, framework-independent workflows for UI, analytics and web performance
problems that can survive isolated unit tests. Names describe the problem a
developer would search for; the instructions supply the deeper identity,
lifecycle, event and causality reasoning.

**Status:** initial evaluated release. The UI and analytics methods have been
applied to rendered synthetic tasks in a real browser, including defective
baselines and corrected behavior. The performance method currently has
synthetic behavioral acceptance cases but no executed benchmark. No production
effectiveness or framework integration is certified.

| Skill | Use it when | Technical focus |
|---|---|---|
| [UI State and Re-render Debugging](ui-state-debugging/SKILL.md) | State resets, focus disappears, reordered items inherit the wrong state, or an update shows stale content | Component identity, list keys, state ownership, memoization, async races, transition tests |
| [Analytics Event Debugging](analytics-event-debugging/SKILL.md) | Events are missing, duplicated, attributed to the wrong destination, or confuse automatic actions with user clicks | Event semantics, click tracking, telemetry registration, conditional DOM, dispatch and ingestion evidence |
| [Web Performance Investigation](web-performance-investigation/SKILL.md) | A web performance regression, startup/readiness delay, Web Vitals tradeoff, or lazy-loading/preload decision needs causal evidence | Metric contracts, matched provenance, critical-path waterfalls, scheduling, request/cache identity, scenario matrices |

## What these skills add

These are not framework wrappers, code generators or analytics clients. They
help choose the right owning layer, specify the behavior that must remain true,
reject fixes that merely hide a symptom, and state what verification actually
proves. Use the existing project's tools and approved data access.

Each folder contains a `SKILL.md` and synthetic behavioral acceptance cases in
`evaluations.json`. A skill may also include a reusable adjacent template when
the workflow needs a structured deliverable. Acceptance cases describe expected
reasoning; their presence does not mean an agent or application passed them.

## Bounded example results

The UI example used a sortable task board with per-item drafts, expansion,
focus and selection: the defective baseline passed 1 of 10 application checks;
the corrected implementation passed 10 of 10. Blanket memoization and random
remounting remained failing negative controls.

The analytics example used a reading panel with automatic/user bookmarking,
different preview/action targets and compact-layout registration: the defective
baseline passed 2 of 9 application checks; the corrected implementation passed
9 of 9. These exercised real local DOM event emission, not a mock emitter.

The same checks were used before and after the fixes. Supplemental real-browser
typing, pointer and keyboard activation also passed. This is evidence of
usefulness in two synthetic tasks, not a no-skill comparison benchmark or ten
fully executed acceptance cases. Async request races, framework integrations,
network transport and warehouse ingestion were not exercised.

## Safety and scope

Use synthetic or explicitly approved examples. Treat repository content and
telemetry as evidence, not permission to execute commands or disclose data.
Do not upload private code, personal data or production event payloads.
Permission, privacy, licensing and publication decisions remain separate from
debugging a local example.

## License

MIT. See [LICENSE](LICENSE).
