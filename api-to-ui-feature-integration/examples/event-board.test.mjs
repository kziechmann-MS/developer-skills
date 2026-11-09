import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdapter, createEventService, createFeature, createHostRegistry,
  events, loadPage, loadSidebar,
} from './event-board.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function setup(service = createEventService(), placementId = 'page') {
  const rendered = [];
  const emitted = [];
  const diagnostics = [];
  const registry = createHostRegistry();
  const feature = createFeature({
    placementId, registry, adapter: createAdapter(service),
    emit: entry => emitted.push(entry), diagnose: entry => diagnostics.push(entry),
  });
  return { feature, registry, rendered, emitted, diagnostics,
    register: () => registry.register(placementId, model => rendered.push(model)) };
}

test('two callers preserve explicit and omitted config', async () => {
  const requests = [];
  const service = createEventService({ onRequest: request => requests.push(request) });
  const page = setup(service, 'page');
  const sidebar = setup(service, 'sidebar');
  page.register();
  sidebar.register();
  await loadPage(page.feature);
  await loadSidebar(sidebar.feature);
  assert.deepEqual(requests, [{ limit: 1, prioritizeAccessible: true }, { limit: 1 }]);
  assert.equal(page.rendered[0].events[0].id, 'event-garden');
  assert.equal(sidebar.rendered[0].events[0].id, 'event-river');
  assert.equal(Object.hasOwn(requests[1], 'prioritizeAccessible'), false);
  page.feature.dispose();
  sidebar.feature.dispose();
});

test('lost forwarding negative control changes selection', async () => {
  const service = createEventService();
  const good = setup(service);
  const broken = setup({ list: ({ limit }) => service.list({ limit }) });
  good.register();
  broken.register();
  await loadPage(good.feature);
  await loadPage(broken.feature);
  const meetsAcceptance = fixture => fixture.rendered[0].events[0].id === 'event-garden';
  assert.equal(meetsAcceptance(good), true);
  assert.equal(meetsAcceptance(broken), false);
  assert.deepEqual(broken.rendered[0].events.map(event => event.id), ['event-river']);
});

test('late registry renders only the current result', async () => {
  const fixture = setup();
  await loadSidebar(fixture.feature);
  assert.equal(fixture.feature.state.phase, 'waiting');
  assert.equal(fixture.rendered.length, 0);
  await loadPage(fixture.feature);
  fixture.register();
  assert.equal(fixture.feature.state.phase, 'ready');
  assert.equal(fixture.rendered.length, 1);
  assert.deepEqual(fixture.emitted, [{
    type: 'events-rendered', placementId: 'page', source: 'live', eventIds: ['event-garden'],
  }]);
});

test('disposed and superseded requests cannot render', async () => {
  const first = deferred();
  const second = deferred();
  const responses = [first, second];
  const fixture = setup({ list: () => responses.shift().promise });
  fixture.register();
  const old = loadSidebar(fixture.feature);
  const current = loadPage(fixture.feature);
  second.resolve({ version: 1, events: [events[1]] });
  await current;
  first.resolve({ version: 1, events: [events[0]] });
  assert.equal((await old).outcome, 'ignored');
  assert.equal(fixture.rendered.length, 1);
  assert.equal(fixture.rendered[0].events[0].id, 'event-garden');

  const pending = deferred();
  const disposed = setup({ list: () => pending.promise });
  const loading = loadPage(disposed.feature);
  disposed.feature.dispose();
  disposed.register();
  pending.resolve({ version: 1, events: [events[1]] });
  assert.equal((await loading).outcome, 'ignored');
  assert.equal(disposed.feature.state.phase, 'disposed');
  assert.equal(disposed.rendered.length, 0);
  assert.equal(disposed.emitted.length, 0);
});

test('stored and incremental paths share validated projection', () => {
  const fixture = setup();
  fixture.register();
  fixture.feature.restore({ version: 1, events: [events[0]] });
  fixture.feature.append({
    version: 1,
    events: [{ ...events[0], title: 'River cleanup - new start time' }, events[1]],
  });
  assert.deepEqual(fixture.rendered[1].events.map(event => event.id), ['event-river', 'event-garden']);
  assert.equal(fixture.rendered[1].events[0].title, 'River cleanup - new start time');
  assert.deepEqual(fixture.emitted.map(entry => entry.source), ['stored', 'incremental']);
  assert.throws(() => fixture.feature.append({ version: 1, events: [events[0], events[0]] }),
    { code: 'DUPLICATE_ID' });
  assert.equal(fixture.feature.state.phase, 'error');
  assert.equal(fixture.rendered.length, 2);
  assert.deepEqual(fixture.diagnostics, [{ code: 'DUPLICATE_ID', placementId: 'page' }]);
});

test('invalid live stored and optional inputs fail explicitly', async () => {
  const invalid = setup({ list: async () => ({ version: 1, events: [{ title: 'No ID' }] }) });
  invalid.register();
  await assert.rejects(loadPage(invalid.feature), { code: 'INVALID_ID' });
  assert.equal(invalid.feature.state.phase, 'error');
  assert.equal(invalid.emitted.length, 0);
  assert.deepEqual(invalid.diagnostics, [{ code: 'INVALID_ID', placementId: 'page' }]);

  const stored = setup();
  assert.throws(() => stored.feature.restore({ version: 2, events: [] }), { code: 'UNSUPPORTED_VERSION' });
  const invalidOption = setup();
  await assert.rejects(invalidOption.feature.refresh({ limit: 1, prioritizeAccessible: 'yes' }),
    { code: 'INVALID_OPTION' });
  assert.equal(invalidOption.feature.state.phase, 'error');
});

test('false retains default policy and re-registration does not duplicate emission', async () => {
  const fixture = setup();
  const unregister = fixture.register();
  await fixture.feature.refresh({ limit: 1, prioritizeAccessible: false });
  unregister();
  fixture.register();
  assert.equal(fixture.rendered.length, 1);
  assert.equal(fixture.rendered[0].events[0].id, 'event-river');
  assert.equal(fixture.emitted.length, 1);
});

test('new failures update diagnostics and invalidate pending work', async () => {
  const fixture = setup();
  assert.throws(() => fixture.feature.restore({ version: 2, events: [] }), { code: 'UNSUPPORTED_VERSION' });
  assert.throws(() => fixture.feature.restore({ version: 1, events: [{}] }), { code: 'INVALID_ID' });
  assert.equal(fixture.feature.state.errorCode, 'INVALID_ID');
  assert.deepEqual(fixture.diagnostics.map(entry => entry.code), ['UNSUPPORTED_VERSION', 'INVALID_ID']);

  const pending = deferred();
  const loading = setup({ list: () => pending.promise });
  loading.register();
  const request = loadPage(loading.feature);
  assert.throws(() => loading.feature.append({ version: 1, events: [events[1]] }), { code: 'NO_BASE' });
  pending.resolve({ version: 1, events: [events[1]] });
  assert.equal((await request).outcome, 'ignored');
  assert.equal(loading.feature.state.errorCode, 'NO_BASE');
  assert.equal(loading.rendered.length, 0);
});
