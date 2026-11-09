import {
  createAdapter, createEventRenderer, createEventService, createFeature,
  createHostRegistry, loadPage, loadSidebar,
} from '/event-board.mjs';
import {
  createClient, createEventStore, createOrchestrator, createRegistryRenderer,
} from '/event-planner.mjs';

const checks = [];
const diagnostics = [];
function verify(name, condition) {
  if (!condition) throw new Error(name);
  checks.push(name);
}
const diagnose = entry => diagnostics.push(entry);
const report = { status: 'running', checks };

try {
  const requests = [];
  const emitted = [];
  const service = createEventService({ onRequest: request => requests.push(request) });
  const registry = createHostRegistry();
  const pageRoot = document.querySelector('#event-page');
  const sidebarRoot = document.querySelector('#event-sidebar');
  const create = placementId => createFeature({
    placementId, registry, adapter: createAdapter(service),
    emit: entry => emitted.push(entry), diagnose,
  });
  const page = create('page');
  const sidebar = create('sidebar');
  await loadSidebar(page);
  await loadPage(page);
  verify('data waits for actual host registration', page.state.phase === 'waiting' && pageRoot.children.length === 0);
  registry.register('page', createEventRenderer(pageRoot));
  registry.register('sidebar', createEventRenderer(sidebarRoot));
  await loadSidebar(sidebar);
  verify('two callers reach service with distinct config',
    requests[1].prioritizeAccessible === true && !Object.hasOwn(requests[2], 'prioritizeAccessible'));
  verify('service selections reach distinct rendered placements',
    pageRoot.firstElementChild.dataset.eventId === 'event-garden' &&
    sidebarRoot.firstElementChild.dataset.eventId === 'event-river');
  verify('late registration emits current event identity once',
    emitted.filter(entry => entry.placementId === 'page').length === 1 &&
    emitted[0].eventIds[0] === 'event-garden');
  const saved = { version: 1, events: [{ id: 'event-river', title: 'River cleanup', accessible: false }] };
  page.restore(saved);
  const riverNode = pageRoot.firstElementChild;
  page.append({ version: 1, events: [{ ...saved.events[0], title: 'River cleanup - new start time' }] });
  verify('incremental title updates preserve actual entity node',
    pageRoot.firstElementChild === riverNode && riverNode.textContent === 'River cleanup - new start time');
  page.dispose();
  sidebar.dispose();

  const plannerRoot = document.querySelector('#planner');
  const statusRoot = document.querySelector('#planner-status');
  const principal = { id: 'fixture-member', roles: ['member'] };
  const store = createEventStore();
  const modelPlan = { version: 1, cards: [{ component: 'event-card', eventId: 'event-river', actions: ['reserve'] }] };
  const text = JSON.stringify(modelPlan);
  const orchestrator = createOrchestrator({
    store, diagnose,
    generate: async function* () {
      yield { kind: 'delta', text: text.slice(0, 20) };
      yield { kind: 'delta', text: text.slice(20) };
      yield { kind: 'complete' };
    },
  });
  const actions = [];
  const render = createRegistryRenderer(plannerRoot, intent => {
    actions.push({ intent, result: orchestrator.act(principal, intent) });
  });
  const client = createClient({
    render, renderStatus: status => { statusRoot.textContent = status; }, diagnose,
  });
  const run = orchestrator.start(principal);
  client.start(run.requestId);
  const messages = [];
  for await (const message of run.stream) {
    messages.push(message);
    client.accept(message);
    if (message.status === 'partial') {
      verify(`partial ${message.sequence} renders status not JSON`,
        plannerRoot.children.length === 0 && statusRoot.textContent === 'partial');
    }
  }
  verify('authoritative data reaches trusted DOM registry',
    plannerRoot.querySelector('h3').textContent === 'River cleanup' &&
    plannerRoot.querySelector('p').textContent === 'Seats: 4' && statusRoot.textContent === 'ready');
  plannerRoot.querySelector('button').click();
  verify('real button handler reaches independently checked action',
    actions.length === 1 && actions[0].intent.requestId === run.requestId &&
    actions[0].result.seatsRemaining === 3 && store.get('event-river').seats === 3);

  const article = plannerRoot.firstElementChild;
  const documentUpdate = structuredClone(client.state.document);
  documentUpdate.components[0].props.title = '<em>Plain event text</em>';
  render(documentUpdate);
  verify('registry preserves entity node and uses safe plain-text sink',
    plannerRoot.firstElementChild === article &&
    plannerRoot.querySelector('h3').textContent === '<em>Plain event text</em>' &&
    plannerRoot.querySelector('em') === null);

  client.start('new-request');
  const stale = client.accept(messages.at(-1));
  verify('stale response cannot revive removed UI',
    stale.reason === 'stale' && plannerRoot.children.length === 0 && !article.isConnected);

  const unsupported = createOrchestrator({
    store, diagnose,
    generate: async function* () {
      yield { kind: 'delta', text: JSON.stringify({
        version: 1, cards: [{ component: 'untrusted-panel', eventId: 'event-river', actions: [] }],
      }) };
      yield { kind: 'complete' };
    },
  });
  const bad = unsupported.start(principal);
  client.start(bad.requestId);
  for await (const message of bad.stream) client.accept(message);
  verify('unsupported model component produces visible invalid state',
    statusRoot.textContent === 'invalid' && plannerRoot.children.length === 0 &&
    diagnostics.some(entry => entry.code === 'UNSUPPORTED_COMPONENT'));

  const cancelled = createOrchestrator({
    store, diagnose,
    generate: () => ({
      [Symbol.asyncIterator]() { return this; },
      next: () => new Promise(() => {}),
      return: async () => ({ done: true }),
    }),
  });
  const controller = new AbortController();
  const cancelRun = cancelled.start(principal, { signal: controller.signal });
  client.start(cancelRun.requestId);
  client.accept((await cancelRun.stream.next()).value);
  const pending = cancelRun.stream.next();
  controller.abort();
  client.accept((await pending).value);
  await cancelRun.stream.next();
  verify('cancelled middle-tier request leaves no actionable DOM',
    statusRoot.textContent === 'cancelled' && plannerRoot.children.length === 0);
  client.dispose();
  verify('disposed client rejects updates',
    client.accept(messages.at(-1)).reason === 'disposed' && statusRoot.textContent === 'disposed');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
}

globalThis.fixtureResult = report;
document.querySelector('#result').textContent = JSON.stringify(report);
