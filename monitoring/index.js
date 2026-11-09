const crypto = require('crypto');
const { appendRun, readRuns } = require('./store');
const { evaluateHealth } = require('./health');

const registry = new Map();
const recentRuns = [];
const MAX_RECENT = Number(process.env.SCRAPER_MONITORING_MEMORY_RUNS || 2000);

function slug(value) {
  return String(value || 'anonymous-scraper')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function registerScraper(config) {
  const id = config.id || slug(config.name);
  if (!registry.has(id)) {
    registry.set(id, {
      id,
      name: config.name || id,
      category: config.category || 'other',
      source: config.source || null,
      description: config.description || null,
      expectedIntervalMs: config.expectedIntervalMs || null,
      staleAfterMs: config.staleAfterMs || null,
      timeoutMs: config.timeoutMs || null,
      enabled: config.enabled !== false,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      emptyRuns: 0,
      consecutiveFailures: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastDurationMs: null,
      lastStatus: null,
      lastError: null,
      lastResultCount: null,
      averageDurationMs: null,
    });
  }
  return registry.get(id);
}

function countRecords(result) {
  if (Array.isArray(result)) return result.length;
  if (result && Array.isArray(result.data)) return result.data.length;
  if (result && Array.isArray(result.stocks)) return result.stocks.length;
  if (result && typeof result === 'object' && Object.keys(result).length) return 1;
  return 0;
}

function safeError(error) {
  return {
    name: error && error.name ? String(error.name) : 'Error',
    message: String((error && error.message) || error || 'Unknown error').slice(0, 500),
    code: error && error.code ? String(error.code).slice(0, 80) : null,
    httpStatus: error && error.response && error.response.status ? error.response.status : null,
  };
}

async function track(config, scraperFn, args = []) {
  const state = registerScraper(config);
  const startedAt = new Date();
  const started = Date.now();
  const run = {
    runId: crypto.randomUUID(),
    scraperId: state.id,
    scraperName: state.name,
    category: state.category,
    startedAt: startedAt.toISOString(),
    status: 'success',
    resultCount: 0,
    error: null,
  };

  try {
    const result = await scraperFn(...args);
    const resultCount = countRecords(result);
    const returnedError = result && !Array.isArray(result) && result.error;
    run.resultCount = resultCount;
    if (returnedError) {
      run.status = 'failed';
      run.error = safeError(new Error(typeof returnedError === 'string' ? returnedError : 'Scraper returned an error result'));
    } else if (resultCount === 0) {
      run.status = 'empty';
    }
    return result;
  } catch (error) {
    run.status = 'failed';
    run.error = safeError(error);
    throw error;
  } finally {
    run.finishedAt = new Date().toISOString();
    run.durationMs = Date.now() - started;
    state.totalRuns += 1;
    state.lastRunAt = run.finishedAt;
    state.lastDurationMs = run.durationMs;
    state.lastStatus = run.status;
    state.lastResultCount = run.resultCount;
    state.averageDurationMs = state.averageDurationMs == null
      ? run.durationMs
      : Math.round(((state.averageDurationMs * (state.totalRuns - 1)) + run.durationMs) / state.totalRuns);

    if (run.status === 'success') {
      state.successfulRuns += 1;
      state.lastSuccessAt = run.finishedAt;
      state.consecutiveFailures = 0;
      state.lastError = null;
    } else {
      if (run.status === 'empty') state.emptyRuns += 1;
      else {
        state.failedRuns += 1;
        state.lastFailureAt = run.finishedAt;
        state.consecutiveFailures += 1;
      }
      state.lastError = run.error;
    }

    recentRuns.unshift(run);
    if (recentRuns.length > MAX_RECENT) recentRuns.length = MAX_RECENT;
    appendRun(run).catch((error) => console.error('[monitoring] Could not persist run:', error.message));
  }
}

function monitored(config, fn) {
  const state = registerScraper(config);
  const wrapped = (...args) => track({ ...config, id: state.id }, fn, args);
  Object.defineProperty(wrapped, 'name', { value: fn.name || state.id, configurable: true });
  wrapped.scraperId = state.id;
  return wrapped;
}

function listScrapers() {
  return Array.from(registry.values()).map((state) => {
    const health = evaluateHealth(state);
    const successRate = state.totalRuns ? Number(((state.successfulRuns / state.totalRuns) * 100).toFixed(1)) : null;
    return { ...state, health, successRate };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function getScraper(id) {
  const state = registry.get(id);
  if (!state) return null;
  const health = evaluateHealth(state);
  return { ...state, health, successRate: state.totalRuns ? Number(((state.successfulRuns / state.totalRuns) * 100).toFixed(1)) : null };
}

async function getRuns(id, limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const memory = recentRuns.filter((run) => !id || run.scraperId === id);
  if (memory.length >= safeLimit) return memory.slice(0, safeLimit);
  const persisted = await readRuns(safeLimit, id);
  const seen = new Set(memory.map((run) => run.runId));
  return memory.concat(persisted.filter((run) => !seen.has(run.runId))).slice(0, safeLimit);
}

async function getOverview() {
  const scrapers = listScrapers();
  const counts = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  scrapers.forEach((item) => { counts[item.health.status] = (counts[item.health.status] || 0) + 1; });
  return {
    status: counts.unhealthy ? 'unhealthy' : counts.degraded ? 'degraded' : counts.unknown ? 'unknown' : 'healthy',
    generatedAt: new Date().toISOString(),
    totals: { scrapers: scrapers.length, ...counts },
    scrapers,
  };
}

module.exports = { registerScraper, monitored, track, listScrapers, getScraper, getRuns, getOverview };
