export class IntegrationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function requireValue(condition, code) {
  if (!condition) throw new IntegrationError(code);
}

export const events = [
  { id: 'event-river', title: 'River cleanup', accessible: false },
  { id: 'event-garden', title: 'Community garden tour', accessible: true },
];

export function projectResponse(response) {
  requireValue(response?.version === 1, 'UNSUPPORTED_VERSION');
  requireValue(Array.isArray(response.events) && response.events.length <= 50, 'INVALID_EVENTS');
  const ids = new Set();
  const projected = response.events.map(event => {
    requireValue(typeof event?.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(event.id), 'INVALID_ID');
    requireValue(!ids.has(event.id), 'DUPLICATE_ID');
    ids.add(event.id);
    requireValue(typeof event.title === 'string' && event.title.length > 0 && event.title.length <= 160, 'INVALID_TITLE');
    requireValue(typeof event.accessible === 'boolean', 'INVALID_ACCESSIBILITY');
    return { id: event.id, title: event.title, accessible: event.accessible };
  });
  return { kind: 'event-list', version: 1, events: projected };
}

export function createEventService({ onRequest = () => {} } = {}) {
  return {
    async list(options) {
      requireValue(Number.isInteger(options.limit) && options.limit > 0 && options.limit <= 50, 'INVALID_LIMIT');
      requireValue(options.prioritizeAccessible === undefined ||
        typeof options.prioritizeAccessible === 'boolean', 'INVALID_OPTION');
      onRequest(structuredClone(options));
      const candidates = [...events];
      if (options.prioritizeAccessible) {
        candidates.sort((a, b) => Number(b.accessible) - Number(a.accessible));
      }
      return { version: 1, events: structuredClone(candidates.slice(0, options.limit)) };
    },
  };
}

export function createAdapter(service) {
  return {
    async load({ limit, prioritizeAccessible }) {
      const options = { limit };
      if (prioritizeAccessible !== undefined) options.prioritizeAccessible = prioritizeAccessible;
      return projectResponse(await service.list(options));
    },
    restore: projectResponse,
    append(current, batch) {
      const incoming = projectResponse(batch);
      const merged = new Map(current.events.map(event => [event.id, event]));
      for (const event of incoming.events) merged.set(event.id, event);
      return projectResponse({ version: 1, events: [...merged.values()] });
    },
  };
}

export function createHostRegistry() {
  const renderers = new Map();
  const listeners = new Map();
  return {
    get: placementId => renderers.get(placementId),
    subscribe(placementId, listener) {
      if (!listeners.has(placementId)) listeners.set(placementId, new Set());
      const group = listeners.get(placementId);
      group.add(listener);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(placementId);
      };
    },
    register(placementId, render) {
      requireValue(!renderers.has(placementId) && typeof render === 'function', 'INVALID_REGISTRATION');
      renderers.set(placementId, render);
      for (const listener of listeners.get(placementId) ?? []) listener();
      return () => {
        if (renderers.get(placementId) === render) renderers.delete(placementId);
      };
    },
  };
}

export function createFeature({ placementId, adapter, registry, emit, diagnose }) {
  requireValue(typeof placementId === 'string' && placementId.length > 0, 'INVALID_PLACEMENT');
  requireValue(typeof emit === 'function' && typeof diagnose === 'function', 'MISSING_OBSERVERS');
  let epoch = 0;
  let state = { phase: 'idle', model: null, errorCode: null };
  let pending = null;

  function fail(error) {
    const code = error instanceof IntegrationError ? error.code : 'INTEGRATION_FAILURE';
    pending = null;
    state = { phase: 'error', model: null, errorCode: code };
    diagnose({ code, placementId });
  }

  function flush() {
    const model = pending?.model ?? state.model;
    if (!model || state.phase === 'disposed') return;
    const render = registry.get(placementId);
    if (!render) {
      state.phase = 'waiting';
      return;
    }
    const result = pending;
    pending = null;
    try {
      render(structuredClone(model));
      if (result) {
        emit({
          type: 'events-rendered',
          placementId,
          source: result.source,
          eventIds: result.model.events.map(event => event.id),
        });
      }
      state = { phase: 'ready', model, errorCode: null };
    } catch (error) {
      fail(error);
      throw error;
    }
  }

  function commit(model, source) {
    state = { phase: 'waiting', model, errorCode: null };
    pending = { model, source };
    flush();
    return { outcome: state.phase };
  }

  function requireActive() {
    requireValue(state.phase !== 'disposed', 'DISPOSED');
  }

  const unsubscribe = registry.subscribe(placementId, flush);
  return {
    get state() { return structuredClone(state); },
    async refresh(options) {
      requireActive();
      const request = ++epoch;
      pending = null;
      state = { phase: 'loading', model: null, errorCode: null };
      try {
        const model = await adapter.load(options);
        if (request !== epoch) return { outcome: 'ignored', reason: 'superseded-or-disposed' };
        return commit(model, 'live');
      } catch (error) {
        if (request !== epoch) return { outcome: 'ignored', reason: 'superseded-or-disposed' };
        if (state.phase !== 'error') fail(error);
        throw error;
      }
    },
    restore(snapshot) {
      requireActive();
      ++epoch;
      pending = null;
      state = { phase: 'loading', model: null, errorCode: null };
      try {
        return commit(adapter.restore(snapshot), 'stored');
      } catch (error) {
        if (state.phase !== 'error') fail(error);
        throw error;
      }
    },
    append(batch) {
      requireActive();
      const base = ['waiting', 'ready'].includes(state.phase) ? state.model : null;
      ++epoch;
      pending = null;
      state = { phase: 'loading', model: null, errorCode: null };
      try {
        requireValue(base, 'NO_BASE');
        return commit(adapter.append(base, batch), 'incremental');
      } catch (error) {
        if (state.phase !== 'error') fail(error);
        throw error;
      }
    },
    dispose() {
      ++epoch;
      pending = null;
      unsubscribe();
      state = { phase: 'disposed', model: null, errorCode: null };
    },
  };
}

export const loadPage = feature => feature.refresh({ limit: 1, prioritizeAccessible: true });
export const loadSidebar = feature => feature.refresh({ limit: 1 });

export function createEventRenderer(root) {
  const nodes = new Map();
  return model => {
    for (const [id, node] of nodes) {
      if (!model.events.some(event => event.id === id)) {
        node.remove();
        nodes.delete(id);
      }
    }
    for (const event of model.events) {
      let node = nodes.get(event.id);
      if (!node) {
        node = root.ownerDocument.createElement('li');
        node.dataset.eventId = event.id;
        nodes.set(event.id, node);
      }
      node.textContent = event.title;
      root.append(node);
    }
  };
}
