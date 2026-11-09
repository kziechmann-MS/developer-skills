# Integration boundary checks

Load after the main workflow when selecting tests. Use only applicable rows and
explain exclusions. Source inspection is useful, but a stub accepting a flag is
not proof that the real adapter sends it.

## Edge ledger

| Edge | Question | Boundary-level observation |
|---|---|---|
| Caller -> configuration | Which caller enables it; what does omission mean? | Capture explicit and omitted service inputs from two real callers |
| Adapter -> service | Is optional config forwarded, normalized or dropped? | Invoke through the adapter, not the service directly |
| Service -> projection | Who has all eligible candidates and owns selection? | Use a candidate excluded by default selection; assert the selected ID |
| Projection -> owner | Are identity, relevant metadata and versions preserved? | Assert model values and invalid/missing/duplicate ID behavior |
| Owner -> host | What if response wins the readiness race? | Delay actual registration and then mount the current result once |
| Host -> renderer | Does the real placement resolve the right renderer? | Exercise registry lookup and inspect output, not a mock mount call |
| Renderer -> interaction | Does behavior use current IDs/context? | Activate the real action; inspect its destination/intent |
| Interaction -> telemetry | Is semantic metadata correct? | Capture the actual fixture emitter payload; DOM alone is insufficient |

## Path matrix template

| Path | Config and identity | Expected result | Proof / explicit limitation |
|---|---|---|---|
| Main caller | Supplied option, stable entity ID | New behavior | Actual outgoing option and selected ID |
| Secondary caller | Option omitted | Old default | Option omission and old result |
| Saved result | Persisted version and IDs | Validated projection | Decode -> owner -> registered render |
| Incremental batch | Existing and new IDs | Documented merge policy | Updated existing entity, added entity, duplicate rejection |
| Before host registration | Placement ID separate from event ID | Wait, then render once | Real registry transition |
| Replacement host | Current model survives a host change | Restore into the new host without a new data-result event | Distinct renderer/root receives current data; emitted result count is unchanged |
| Superseded request | Request identity separate from entity | Older completion ignored | Controlled completion order |
| After disposal | No active owner | No render/emission | Resolve pending work after disposal |
| Failure | Invalid response or missing field | Explicit failure/diagnostic | No success-shaped empty fallback |

A stored snapshot may have information the live stream never supplies. A
fixture's append API is not a network streaming implementation. Validate a real
project's stream assembly, ordering and cancellation separately.

## Good proof versus a tempting proxy

- Signature accepts `prioritizeAccessible`: inspect both callers and assert the
  adapter's actual outgoing arguments.
- Adapter unit test uses a mock returning every event: a real preselecting
  fixture service is needed to expose a flag lost before truncation.
- Card exists: assert semantic ID, updated title and action context, not only
  element count.
- Telemetry mock was called: inspect actual event shape, origin and target.
  This still does not establish network transport or ingestion.
- Saved content renders: test live/incremental projection separately, or mark
  it unverified.
- Data load completes: delay registration, supersede the request and dispose
  the owner; data readiness is not host readiness.
- Result rendered once: replace the host with a distinct renderer/root and
  verify the current model is restored without treating host restoration as a
  new data result. Cumulative callbacks alone can hide a blank replacement.

## Rejected shortcuts

Do not duplicate eligibility/ranking in a client without the full candidate set.
Do not enable a shared option globally to make one caller work. Do not create a
fake host missing from the real layout. Do not manufacture random IDs, bypass
validation for saved data, or describe static source checks as rendered proof.
