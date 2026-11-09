const DEFAULT_STALE_AFTER_MS = Number(process.env.SCRAPER_STALE_AFTER_MS || 2 * 60 * 60 * 1000);

function evaluateHealth(state, now = Date.now()) {
  if (!state || !state.lastRunAt) {
    return { status: 'unknown', score: null, reasons: ['No execution has been recorded yet'] };
  }

  const age = now - new Date(state.lastRunAt).getTime();
  const staleAfter = state.staleAfterMs || DEFAULT_STALE_AFTER_MS;
  const reasons = [];
  let score = 100;
  let status = 'healthy';

  if (state.lastStatus === 'failed') {
    score -= 60;
    reasons.push('Most recent execution failed');
  }
  if (state.consecutiveFailures > 0) {
    score -= Math.min(30, state.consecutiveFailures * 10);
    reasons.push(state.consecutiveFailures + ' consecutive failure(s)');
  }
  if (state.lastStatus === 'empty') {
    score -= 35;
    reasons.push('Most recent execution returned no usable records');
  }
  if (age > staleAfter) {
    score -= 30;
    reasons.push('No recent execution; last run is older than the configured freshness window');
  }
  if (state.lastDurationMs > (state.timeoutMs || 120000)) {
    score -= 10;
    reasons.push('Execution exceeded its expected duration');
  }

  score = Math.max(0, Math.min(100, score));
  if (state.lastStatus === 'failed' || state.consecutiveFailures >= 3 || score < 40) status = 'unhealthy';
  else if (state.lastStatus === 'empty' || age > staleAfter || score < 80) status = 'degraded';

  return {
    status,
    score,
    reasons,
    lastRunAgeMs: Math.max(0, age),
    staleAfterMs: staleAfter,
  };
}

module.exports = { evaluateHealth };
