# Offline event-planner example

Fictional community events; no provider SDK, packages, paid model calls, external
services or production data. Requires Node 22 or later. From the repository root
on Windows:

```powershell
node --test .\generative-ui-development\examples\event-planner.test.mjs
```

`event-planner.mjs` models both sides of an application boundary in one small
module for inspection. Its exported functions are **not HTTP endpoints**.
The host application must supply a trusted authenticated principal; accepting a
principal from JSON would not be authentication. No real credentials are used.

## Contracts and implementation decisions

The injected model adapter receives a bounded prompt, authorized event IDs, a
capability list and an abort signal. It returns an async iterable of
`{kind: "delta", text}`, `{kind: "complete"}` or `{kind: "refusal"}` messages.
This is a fixture protocol, not an actual provider API. One model call, no retry,
at most 16 chunks, 4096 output characters, 1000 prompt characters and 1000 ms
local deadline are the defaults. Tests override limits to probe failure.
After yielding loading, the orchestrator rechecks cancellation and current
request applicability immediately before invoking the adapter. Cancellation,
supersession or deadline expiry during that suspension must dispatch no model
work, rather than merely rejecting its result afterward.

The complete model document is:

```json
{
  "version": 1,
  "cards": [
    { "component": "event-card", "eventId": "event-river", "actions": ["reserve"] }
  ]
}
```

The middle tier validates the document, rejects unknown fields/capabilities and
duplicate event IDs, checks visibility/membership, looks up titles and seats,
and produces a versioned UI document. Entity `event-river`, component
`event:event-river`, request UUID and sequence/revision are distinct. A title
and seat count cannot be invented by the model because they are not model
contract fields.

**Atomic commit:** deltas expose only trusted partial status, not fragments or
partial components. After complete validation the client commits a document
through its trusted `event-card` renderer. Starting a new request clears old
content; terminal non-success clears it too. Old requests, old sequences and
post-disposal updates cannot render. This is not incremental component streaming.

Reserve intent contains request ID, revision, component ID and action name.
The server independently checks request ownership, current scope, capability
and current membership before the store effect. An identical action is
idempotent within one live request, but reauthorization still happens before
returning a cached result. A new request invalidates the old request's actions.

## Frozen acceptance criteria

| Test group | Required observation |
|---|---|
| Valid vertical slice | Injected output -> authorized shaping -> client document -> server action decrements seats |
| Invalid output | Malformed JSON, version/component/action/field errors, duplicates and unknown events do not render |
| Partial | Two incomplete chunks render no components; complete document renders once |
| Loading suspension | Consuming loading, then cancelling/superseding/expiring before resumption invokes the eager adapter zero times; a superseding request still completes normally |
| Stale/cancelled | Supersession and cancellation prevent ready output; late provider result cannot revive it |
| Client boundary | Request/sequence checks, independent document validation and disposal |
| Authorization | Forged capability/principal/revision, revoked membership, stale request and duplicate writes |
| Visibility | A viewer cannot obtain a member-only event or reserve through model output |
| Terminal/budget | Refusal, provider failure, incomplete output, output/chunk/input limits, timeout and pre-cancellation |

The optional shared browser check in `checks` exercises the exported DOM
registry and real button handler. Node render observers alone do not prove DOM
behavior. All data and model responses are frozen, invented scenarios.

## Deliberate limits

This demonstrates boundary reasoning, not production authentication, a complete
tool dispatcher, a framework/provider SDK, model quality or prompt-injection
resistance. Character and step limits are not token/billing guarantees.
The deadline starts when the stream is consumed; a consumer must drain/close it.
Local abort rejects waiting and requests iterator cleanup without waiting
forever for a noncooperative provider. It does not prove remote compute stopped.

Request/idempotency state is in-memory and retained for this bounded example.
Production needs bounded retention, real session/tenant enforcement, transport
auth/CSRF as applicable, request-rate/concurrency limits, provider controls,
durable idempotency and transactional reservations. Version 1 accepts only one
final UI revision and the single trusted component/action; no arbitrary links,
HTML, executable output or rich-content sanitization is implemented.

## Execution status

See the repository README for commands actually executed. These tests are
implementation examples, not with/without-skill agent trials. The authored
`evaluations.json` rubric is not an executed agent evaluation.
