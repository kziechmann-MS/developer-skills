import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClient, createEventStore, createOrchestrator, validateDocument,
} from './event-planner.mjs';

const member = () => ({ id: 'fixture-member', roles: ['member'] });
const viewer = () => ({ id: 'fixture-viewer', roles: [] });
const plan = (overrides = {}) => ({
  version: 1,
  cards: [{ component: 'event-card', eventId: 'event-river', actions: ['reserve'], ...overrides }],
});

function scripted(chunks) {
  return async function* () { yield* chunks; };
}

function output(value) {
  return scripted([{ kind: 'delta', text: JSON.stringify(value) }, { kind: 'complete' }]);
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function stalled(gate, cleanup) {
  return {
    [Symbol.asyncIterator]() { return this; },
    next: () => gate.promise,
    return() { cleanup(); return Promise.resolve({ done: true }); },
  };
}

function setup({ generate = output(plan()), limits } = {}) {
  const diagnostics = [];
  const rendered = [];
  const statuses = [];
  const store = createEventStore();
  const diagnose = entry => diagnostics.push(entry);
  const orchestrator = createOrchestrator({ generate, store, diagnose, limits });
  const client = createClient({
    render: document => { if (document) rendered.push(document); },
    renderStatus: status => statuses.push(status), diagnose,
  });
  return { store, orchestrator, client, diagnostics, rendered, statuses };
}

async function consume(fixture, principal = member(), options) {
  const run = fixture.orchestrator.start(principal, options);
  fixture.client.start(run.requestId);
  const messages = [];
  for await (const message of run.stream) {
    messages.push(message);
    fixture.client.accept(message);
  }
  return { run, messages, last: messages.at(-1) };
}

test('valid model output reaches client and authorized action', async () => {
  let adapterInput;
  const fixture = setup({
    generate: input => { adapterInput = input; return output(plan())(); },
  });
  const principal = member();
  const { last } = await consume(fixture, principal);
  assert.equal(last.status, 'ready');
  assert.deepEqual(adapterInput.eventIds, ['event-river', 'event-garden']);
  assert.deepEqual(adapterInput.capabilities, ['event-card', 'reserve']);
  assert.equal(fixture.rendered.length, 1);
  const document = fixture.rendered[0];
  assert.equal(document.components[0].id, 'event:event-river');
  assert.deepEqual(document.components[0].props,
    { eventId: 'event-river', title: 'River cleanup', seats: 4 });
  const result = fixture.orchestrator.act(principal, {
    requestId: document.requestId, revision: 1, componentId: 'event:event-river', action: 'reserve',
  });
  assert.deepEqual(result, { eventId: 'event-river', seatsRemaining: 3 });
  assert.equal(fixture.store.get('event-river').seats, 3);
  assert.deepEqual(fixture.diagnostics, []);
});

test('invalid and unsupported output never reaches renderer', async t => {
  const cases = [
    ['malformed JSON', '{', 'INVALID_JSON'],
    ['schema version', JSON.stringify({ ...plan(), version: 2 }), 'UNSUPPORTED_VERSION'],
    ['component', JSON.stringify(plan({ component: 'script-panel' })), 'UNSUPPORTED_COMPONENT'],
    ['action', JSON.stringify(plan({ actions: ['run-code'] })), 'UNSUPPORTED_ACTION'],
    ['duplicate', JSON.stringify({ version: 1, cards: [plan().cards[0], plan().cards[0]] }), 'DUPLICATE_ID'],
    ['handler field', JSON.stringify(plan({ handler: 'untrusted text, never executed' })), 'INVALID_FIELDS'],
    ['unknown event', JSON.stringify(plan({ eventId: 'event-unknown' })), 'FORBIDDEN_EVENT'],
    ['empty result', JSON.stringify({ version: 1, cards: [] }), 'INVALID_CARDS'],
  ];
  for (const [name, text, code] of cases) {
    await t.test(name, async () => {
      const fixture = setup({ generate: scripted([{ kind: 'delta', text }, { kind: 'complete' }]) });
      const { last } = await consume(fixture);
      assert.equal(last.status, 'invalid');
      assert.equal(last.code, code);
      assert.equal(fixture.client.state.status, 'invalid');
      assert.equal(fixture.rendered.length, 0);
      assert.deepEqual(fixture.diagnostics, [{ code, requestId: last.requestId }]);
    });
  }
});

test('partial output commits only at completion', async () => {
  const text = JSON.stringify(plan());
  const fixture = setup({
    generate: scripted([
      { kind: 'delta', text: text.slice(0, 25) },
      { kind: 'delta', text: text.slice(25) },
      { kind: 'complete' },
    ]),
  });
  const run = fixture.orchestrator.start(member());
  fixture.client.start(run.requestId);
  for (const expected of ['loading', 'partial', 'partial', 'ready']) {
    const { value } = await run.stream.next();
    assert.equal(value.status, expected);
    fixture.client.accept(value);
    assert.equal(fixture.rendered.length, expected === 'ready' ? 1 : 0);
    if (expected === 'partial') assert.equal(Object.hasOwn(value, 'document'), false);
  }
  assert.equal((await run.stream.next()).done, true);
});

test('cancellation during loading suspension skips adapter dispatch', async () => {
  let calls = 0;
  const fixture = setup({ generate: () => { calls++; return output(plan())(); } });
  const controller = new AbortController();
  const run = fixture.orchestrator.start(member(), { signal: controller.signal });
  assert.equal((await run.stream.next()).value.status, 'loading');
  controller.abort();
  const messages = [];
  for await (const message of run.stream) messages.push(message);
  assert.deepEqual(messages.map(message => [message.status, message.code]), [['cancelled', 'CANCELLED']]);
  assert.equal(calls, 0);
});

test('supersession during loading suspension skips old adapter dispatch', async () => {
  const prompts = [];
  const fixture = setup({ generate: input => { prompts.push(input.prompt); return output(plan())(); } });
  const principal = member();
  const old = fixture.orchestrator.start(principal, { prompt: 'Old request' });
  assert.equal((await old.stream.next()).value.status, 'loading');
  const current = fixture.orchestrator.start(principal, { prompt: 'Current request' });
  const oldMessages = [];
  for await (const message of old.stream) oldMessages.push(message);
  const callsBeforeCurrent = prompts.length;
  const currentMessages = [];
  for await (const message of current.stream) currentMessages.push(message);
  assert.deepEqual(oldMessages.map(message => [message.status, message.code]), [['stale', 'STALE']]);
  assert.equal(currentMessages.at(-1).status, 'ready');
  assert.equal(callsBeforeCurrent, 0);
  assert.deepEqual(prompts, ['Current request']);
});

test('deadline during loading suspension skips adapter dispatch', { timeout: 2000 }, async () => {
  let calls = 0;
  const fixture = setup({
    generate: () => { calls++; return output(plan())(); }, limits: { deadlineMs: 10 },
  });
  const run = fixture.orchestrator.start(member());
  assert.equal((await run.stream.next()).value.status, 'loading');
  await new Promise(resolve => setTimeout(resolve, 20));
  const messages = [];
  for await (const message of run.stream) messages.push(message);
  assert.deepEqual(messages.map(message => [message.status, message.code]), [['error', 'TIMEOUT']]);
  assert.equal(calls, 0);
});

test('superseded and cancelled work cannot become ready', async () => {
  const gate = deferred();
  let calls = 0;
  let cleaned = 0;
  const fixture = setup({
    generate: () => ++calls === 1 ? stalled(gate, () => cleaned++) : output(plan())(),
  });
  const principal = member();
  const old = fixture.orchestrator.start(principal);
  await old.stream.next();
  const pending = old.stream.next();
  const current = await consume(fixture, principal);
  const stale = (await pending).value;
  assert.equal(stale.status, 'stale');
  assert.equal(fixture.client.accept(stale).reason, 'stale');
  await old.stream.next();
  gate.resolve({ done: false, value: { kind: 'complete' } });
  assert.equal(current.last.status, 'ready');
  assert.equal(fixture.rendered.length, 1);
  assert.equal(cleaned, 1);

  const cancelGate = deferred();
  const cancelled = setup({ generate: () => stalled(cancelGate, () => cleaned++) });
  const controller = new AbortController();
  const run = cancelled.orchestrator.start(principal, { signal: controller.signal });
  cancelled.client.start(run.requestId);
  cancelled.client.accept((await run.stream.next()).value);
  const waiting = run.stream.next();
  controller.abort();
  const message = (await waiting).value;
  cancelled.client.accept(message);
  await run.stream.next();
  cancelGate.resolve({ done: false, value: { kind: 'complete' } });
  assert.equal(message.status, 'cancelled');
  assert.equal(cancelled.client.state.status, 'cancelled');
  assert.equal(cancelled.rendered.length, 0);
  assert.equal(cleaned, 2);
});

test('client rejects stale sequences and disposed updates', async () => {
  const fixture = setup();
  const { last } = await consume(fixture);
  fixture.client.start('next-request');
  assert.equal(fixture.client.accept(last).reason, 'stale');
  assert.equal(fixture.client.accept({ requestId: 'next-request', sequence: 2, status: 'partial' }).accepted, true);
  assert.equal(fixture.client.accept({ requestId: 'next-request', sequence: 1, status: 'loading' }).reason, 'out-of-order');
  fixture.client.dispose();
  assert.equal(fixture.client.accept(last).reason, 'disposed');
  assert.equal(fixture.client.state.document, null);
});

test('client independently validates transport documents', async () => {
  const fixture = setup();
  const { last } = await consume(fixture);
  fixture.client.start('transport-request');
  const forged = {
    ...last, requestId: 'transport-request',
    document: { ...last.document, requestId: 'transport-request', version: 999 },
  };
  assert.equal(fixture.client.accept(forged).reason, 'invalid');
  assert.equal(fixture.client.state.status, 'invalid');
  assert.equal(fixture.rendered.length, 1);
  assert.throws(() => validateDocument({ ...last.document, revision: 2 }), { code: 'INVALID_CORRELATION' });
});

test('forged revoked stale and replayed actions are checked server-side', async () => {
  const fixture = setup();
  const principal = member();
  const { last } = await consume(fixture, principal);
  const intent = { requestId: last.requestId, revision: 1, componentId: 'event:event-river', action: 'reserve' };
  const once = fixture.orchestrator.act(principal, intent);
  assert.deepEqual(fixture.orchestrator.act(principal, intent), once);
  assert.equal(fixture.store.get('event-river').seats, 3);
  assert.throws(() => fixture.orchestrator.act(viewer(), intent), { code: 'FORBIDDEN_ACTION' });
  assert.throws(() => fixture.orchestrator.act(principal, { ...intent, action: 'run-code' }), { code: 'FORBIDDEN_ACTION' });
  assert.throws(() => fixture.orchestrator.act(principal, { ...intent, revision: 2 }), { code: 'STALE_ACTION' });
  principal.roles = [];
  assert.throws(() => fixture.orchestrator.act(principal, intent), { code: 'FORBIDDEN_ACTION' });
  principal.roles = ['member'];
  fixture.orchestrator.start(principal);
  assert.throws(() => fixture.orchestrator.act(principal, intent), { code: 'STALE_ACTION' });

  const guest = setup({ generate: output(plan({ actions: [] })) });
  const { last: guestLast } = await consume(guest, viewer());
  assert.equal(guestLast.status, 'ready');
  assert.throws(() => guest.orchestrator.act(viewer(), { ...intent, requestId: guestLast.requestId }),
    { code: 'FORBIDDEN_ACTION' });
});

test('model proposals do not bypass visibility or membership', async () => {
  const privateEvent = setup({ generate: output(plan({ eventId: 'event-garden', actions: [] })) });
  assert.equal((await consume(privateEvent, viewer())).last.code, 'FORBIDDEN_EVENT');
  const forbidden = setup();
  assert.equal((await consume(forbidden, viewer())).last.code, 'FORBIDDEN_ACTION');
  assert.equal(forbidden.rendered.length, 0);
});

test('refusal failure incomplete and budgets are explicit', async t => {
  const cases = [
    ['refused', scripted([{ kind: 'delta', text: '{' }, { kind: 'refusal' }]), {}, 'refused', undefined],
    ['provider failure', async function* () { throw new Error('Fictional provider detail'); }, {}, 'error', 'MODEL_FAILURE'],
    ['incomplete', scripted([{ kind: 'delta', text: '{' }]), {}, 'error', 'INCOMPLETE_OUTPUT'],
    ['output limit', output(plan()), { maxOutputChars: 10 }, 'error', 'OUTPUT_LIMIT'],
    ['chunk limit', output(plan()), { maxChunks: 1 }, 'error', 'CHUNK_LIMIT'],
  ];
  for (const [name, generate, limits, status, code] of cases) {
    await t.test(name, async () => {
      const fixture = setup({ generate, limits });
      const { last } = await consume(fixture);
      assert.equal(last.status, status);
      assert.equal(last.code, code);
      assert.equal(fixture.rendered.length, 0);
      assert.equal(JSON.stringify(fixture.diagnostics).includes('Fictional provider detail'), false);
    });
  }
  const fixture = setup({ limits: { maxInputChars: 5 } });
  assert.throws(() => fixture.orchestrator.start(member(), { prompt: 'A longer prompt' }), { code: 'INPUT_LIMIT' });
});

test('timeout and cancellation stop local waiting', { timeout: 2000 }, async () => {
  const gate = deferred();
  let cleaned = false;
  const fixture = setup({
    generate: () => stalled(gate, () => { cleaned = true; }), limits: { deadlineMs: 20 },
  });
  const { last } = await consume(fixture);
  assert.equal(last.status, 'error');
  assert.equal(last.code, 'TIMEOUT');
  assert.equal(fixture.rendered.length, 0);
  assert.equal(cleaned, true);
  gate.resolve({ done: true });

  const controller = new AbortController();
  controller.abort();
  let called = false;
  const cancelled = setup({ generate: () => { called = true; return output(plan())(); } });
  const result = await consume(cancelled, member(), { signal: controller.signal });
  assert.equal(result.last.status, 'cancelled');
  assert.equal(called, false);
});
