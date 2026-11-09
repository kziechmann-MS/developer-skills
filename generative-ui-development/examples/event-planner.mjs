export class GenerationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function check(condition, code) {
  if (!condition) throw new GenerationError(code);
}

function fields(value, names) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    names.every(name => Object.hasOwn(value, name)), 'INVALID_FIELDS');
}

const isId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const isRequestId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const canView = (principal, event) => event && (!event.membersOnly || principal.roles.includes('member'));
const canReserve = (principal, event) => canView(principal, event) && principal.roles.includes('member');
const terminal = new Set(['ready', 'invalid', 'refused', 'error', 'cancelled', 'stale']);

function trustedPrincipal(principal) {
  check(typeof principal?.id === 'string' && principal.id.length > 0 &&
    Array.isArray(principal.roles), 'INVALID_PRINCIPAL');
}

export function createEventStore() {
  const records = new Map([
    ['event-river', { id: 'event-river', title: 'River cleanup', seats: 4, membersOnly: false }],
    ['event-garden', { id: 'event-garden', title: 'Community garden tour', seats: 2, membersOnly: true }],
  ]);
  return {
    get: id => records.has(id) ? structuredClone(records.get(id)) : undefined,
    visibleIds: principal => [...records.values()].filter(event => canView(principal, event)).map(event => event.id),
    reserve(id) {
      const event = records.get(id);
      check(event && event.seats > 0, 'SOLD_OUT');
      event.seats -= 1;
      return { eventId: event.id, seatsRemaining: event.seats };
    },
  };
}

function validateActions(actions) {
  check(Array.isArray(actions) && actions.length <= 1 &&
    actions.every(action => action === 'reserve'), 'UNSUPPORTED_ACTION');
}

function compileDescription(raw, principal, store, requestId) {
  fields(raw, ['version', 'cards']);
  check(raw.version === 1, 'UNSUPPORTED_VERSION');
  check(Array.isArray(raw.cards) && raw.cards.length > 0 && raw.cards.length <= 5, 'INVALID_CARDS');
  const seen = new Set();
  const components = raw.cards.map(card => {
    fields(card, ['component', 'eventId', 'actions']);
    check(card.component === 'event-card', 'UNSUPPORTED_COMPONENT');
    check(isId(card.eventId), 'INVALID_ID');
    check(!seen.has(card.eventId), 'DUPLICATE_ID');
    seen.add(card.eventId);
    validateActions(card.actions);
    const event = store.get(card.eventId);
    check(canView(principal, event), 'FORBIDDEN_EVENT');
    if (card.actions.length) check(canReserve(principal, event), 'FORBIDDEN_ACTION');
    return {
      id: `event:${event.id}`, component: 'event-card',
      props: { eventId: event.id, title: event.title, seats: event.seats },
      actions: [...card.actions],
    };
  });
  return validateDocument({ version: 1, requestId, revision: 1, components });
}

export function validateDocument(document) {
  fields(document, ['version', 'requestId', 'revision', 'components']);
  check(document.version === 1, 'UNSUPPORTED_VERSION');
  check(isRequestId(document.requestId) && document.revision === 1, 'INVALID_CORRELATION');
  check(Array.isArray(document.components) && document.components.length > 0 &&
    document.components.length <= 5, 'INVALID_COMPONENTS');
  const seen = new Set();
  for (const component of document.components) {
    fields(component, ['id', 'component', 'props', 'actions']);
    check(component.component === 'event-card', 'UNSUPPORTED_COMPONENT');
    fields(component.props, ['eventId', 'title', 'seats']);
    check(isId(component.props.eventId) && component.id === `event:${component.props.eventId}`, 'INVALID_ID');
    check(!seen.has(component.id), 'DUPLICATE_ID');
    seen.add(component.id);
    check(typeof component.props.title === 'string' && component.props.title.length > 0 &&
      component.props.title.length <= 160, 'INVALID_TITLE');
    check(Number.isInteger(component.props.seats) && component.props.seats >= 0, 'INVALID_SEATS');
    validateActions(component.actions);
  }
  return structuredClone(document);
}

function nextWithSignal(iterator, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => iterator.next()).then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

function stopIterator(iterator, diagnose) {
  if (!iterator?.return) return;
  try {
    Promise.resolve(iterator.return()).catch(() => diagnose({ code: 'CLEANUP_FAILED' }));
  } catch {
    diagnose({ code: 'CLEANUP_FAILED' });
  }
}

const invalidCodes = new Set([
  'INVALID_FIELDS', 'INVALID_JSON', 'INVALID_CARDS', 'UNSUPPORTED_VERSION',
  'UNSUPPORTED_COMPONENT', 'UNSUPPORTED_ACTION', 'INVALID_ID', 'DUPLICATE_ID',
  'FORBIDDEN_EVENT', 'FORBIDDEN_ACTION', 'INVALID_TITLE', 'INVALID_SEATS',
  'INVALID_CORRELATION', 'INVALID_COMPONENTS', 'INVALID_CHUNK',
]);

export function createOrchestrator({ generate, store, diagnose, limits = {} }) {
  check(typeof generate === 'function' && typeof diagnose === 'function', 'MISSING_ADAPTER');
  const budget = { deadlineMs: 1000, maxChunks: 16, maxOutputChars: 4096, maxInputChars: 1000, ...limits };
  check(Object.values(budget).every(value => Number.isInteger(value) && value > 0), 'INVALID_LIMIT');
  const latest = new Map();
  const requests = new Map();

  function start(principal, { prompt = 'Suggest a small community-events plan.', signal } = {}) {
    trustedPrincipal(principal);
    check(typeof prompt === 'string' && prompt.length <= budget.maxInputChars, 'INPUT_LIMIT');
    const previous = requests.get(latest.get(principal.id));
    if (previous) {
      previous.state = 'stale';
      previous.controller.abort(new GenerationError('STALE'));
    }
    const requestId = crypto.randomUUID();
    const entry = { userId: principal.id, state: 'loading', controller: new AbortController(), results: new Map() };
    requests.set(requestId, entry);
    latest.set(principal.id, requestId);

    async function* run() {
      let sequence = 0;
      let iterator;
      let timer;
      const abort = () => entry.controller.abort(new GenerationError('CANCELLED'));
      const envelope = (status, extra = {}) => {
        entry.state = status;
        return { requestId, sequence: ++sequence, status, ...extra };
      };
      try {
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => entry.controller.abort(new GenerationError('TIMEOUT')), budget.deadlineMs);
        if (entry.controller.signal.aborted) throw entry.controller.signal.reason;
        yield envelope('loading');
        iterator = generate({
          prompt, eventIds: store.visibleIds(principal),
          capabilities: ['event-card', 'reserve'], signal: entry.controller.signal,
        })[Symbol.asyncIterator]();
        let text = '';
        let chunks = 0;
        while (true) {
          const next = await nextWithSignal(iterator, entry.controller.signal);
          if (entry.controller.signal.aborted) throw entry.controller.signal.reason;
          check(latest.get(principal.id) === requestId, 'STALE');
          check(!next.done, 'INCOMPLETE_OUTPUT');
          check(++chunks <= budget.maxChunks, 'CHUNK_LIMIT');
          const chunk = next.value;
          if (chunk?.kind === 'delta') {
            fields(chunk, ['kind', 'text']);
            check(typeof chunk.text === 'string', 'INVALID_CHUNK');
            check(text.length + chunk.text.length <= budget.maxOutputChars, 'OUTPUT_LIMIT');
            text += chunk.text;
            yield envelope('partial');
          } else if (chunk?.kind === 'refusal') {
            fields(chunk, ['kind']);
            yield envelope('refused');
            return;
          } else if (chunk?.kind === 'complete') {
            fields(chunk, ['kind']);
            let raw;
            try { raw = JSON.parse(text); } catch { throw new GenerationError('INVALID_JSON'); }
            const document = compileDescription(raw, principal, store, requestId);
            entry.document = document;
            yield envelope('ready', { document: structuredClone(document) });
            return;
          } else {
            throw new GenerationError('INVALID_CHUNK');
          }
        }
      } catch (error) {
        const code = error instanceof GenerationError ? error.code : 'MODEL_FAILURE';
        const status = code === 'CANCELLED' ? 'cancelled' : code === 'STALE' ? 'stale' :
          invalidCodes.has(code) ? 'invalid' : 'error';
        diagnose({ code, requestId });
        yield envelope(status, { code });
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        entry.controller.abort(new GenerationError('CLOSED'));
        stopIterator(iterator, diagnose);
      }
    }
    return { requestId, stream: run() };
  }

  function act(principal, intent) {
    try {
      trustedPrincipal(principal);
      fields(intent, ['requestId', 'revision', 'componentId', 'action']);
      const entry = requests.get(intent.requestId);
      check(entry && entry.userId === principal.id, 'FORBIDDEN_ACTION');
      check(latest.get(principal.id) === intent.requestId && entry.state === 'ready', 'STALE_ACTION');
      check(intent.revision === entry.document.revision, 'STALE_ACTION');
      const component = entry.document.components.find(value => value.id === intent.componentId);
      check(component && intent.action === 'reserve' && component.actions.includes(intent.action), 'FORBIDDEN_ACTION');
      check(canReserve(principal, store.get(component.props.eventId)), 'FORBIDDEN_ACTION');
      const key = `${component.id}:${intent.action}`;
      if (!entry.results.has(key)) entry.results.set(key, store.reserve(component.props.eventId));
      return structuredClone(entry.results.get(key));
    } catch (error) {
      diagnose({ code: error instanceof GenerationError ? error.code : 'ACTION_FAILURE' });
      throw error;
    }
  }
  return { start, act };
}

export function createClient({ render, renderStatus, diagnose }) {
  check([render, renderStatus, diagnose].every(value => typeof value === 'function'), 'MISSING_RENDERER');
  let state = { requestId: null, sequence: 0, status: 'idle', document: null };
  return {
    get state() { return structuredClone(state); },
    start(requestId) {
      check(state.status !== 'disposed' && isRequestId(requestId), 'INVALID_CORRELATION');
      state = { requestId, sequence: 0, status: 'loading', document: null };
      render(null);
      renderStatus('loading');
    },
    accept(message) {
      if (state.status === 'disposed') return { accepted: false, reason: 'disposed' };
      if (!state.requestId || message?.requestId !== state.requestId) return { accepted: false, reason: 'stale' };
      try {
        check(Number.isInteger(message.sequence) && message.sequence > 0, 'INVALID_CORRELATION');
        if (message.sequence <= state.sequence) return { accepted: false, reason: 'out-of-order' };
        if (terminal.has(state.status)) return { accepted: false, reason: 'terminal' };
        check(['loading', 'partial', ...terminal].includes(message.status), 'INVALID_STATUS');
        if (message.status === 'ready') {
          fields(message, ['requestId', 'sequence', 'status', 'document']);
          const document = validateDocument(message.document);
          check(document.requestId === state.requestId, 'INVALID_CORRELATION');
          render(document);
          state.document = document;
        } else {
          fields(message, Object.hasOwn(message, 'code') ?
            ['requestId', 'sequence', 'status', 'code'] : ['requestId', 'sequence', 'status']);
          if (Object.hasOwn(message, 'code')) {
            check(typeof message.code === 'string' && /^[A-Z_]{1,40}$/.test(message.code), 'INVALID_CODE');
          }
          if (terminal.has(message.status)) {
            render(null);
            state.document = null;
          }
        }
        state.sequence = message.sequence;
        state.status = message.status;
        renderStatus(message.status);
        return { accepted: true };
      } catch (error) {
        const code = error instanceof GenerationError ? error.code : 'CLIENT_FAILURE';
        state.status = 'invalid';
        state.document = null;
        render(null);
        renderStatus('invalid');
        diagnose({ code });
        return { accepted: false, reason: 'invalid' };
      }
    },
    dispose() {
      state = { requestId: null, sequence: 0, status: 'disposed', document: null };
      render(null);
      renderStatus('disposed');
    },
  };
}

export function createRegistryRenderer(root, onAction) {
  const nodes = new Map();
  return document => {
    if (document === null) {
      nodes.clear();
      root.replaceChildren();
      return;
    }
    const valid = validateDocument(document);
    for (const [id, record] of nodes) {
      if (!valid.components.some(component => component.id === id)) {
        record.node.remove();
        nodes.delete(id);
      }
    }
    for (const component of valid.components) {
      let record = nodes.get(component.id);
      if (!record) {
        const node = root.ownerDocument.createElement('article');
        const title = root.ownerDocument.createElement('h3');
        const seats = root.ownerDocument.createElement('p');
        const button = root.ownerDocument.createElement('button');
        button.textContent = 'Reserve';
        node.dataset.componentId = component.id;
        node.append(title, seats, button);
        record = { node, title, seats, button };
        button.addEventListener('click', () => {
          if (record.component.actions.includes('reserve')) {
            onAction({
              requestId: record.requestId, revision: record.revision,
              componentId: record.component.id, action: 'reserve',
            });
          }
        });
        nodes.set(component.id, record);
      }
      record.component = component;
      record.requestId = valid.requestId;
      record.revision = valid.revision;
      record.title.textContent = component.props.title;
      record.seats.textContent = `Seats: ${component.props.seats}`;
      record.button.hidden = !component.actions.includes('reserve');
      root.append(record.node);
    }
  };
}
