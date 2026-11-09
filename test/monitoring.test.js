const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scraper-monitor-'));
process.env.SCRAPER_MONITORING_DIR = tempDir;
const { evaluateHealth } = require('../monitoring/health');
const monitor = require('../monitoring');

test('health is unknown before the first run', () => {
  assert.equal(evaluateHealth({ lastRunAt: null }).status, 'unknown');
});

test('a recent successful run is healthy', () => {
  const now = Date.now();
  const health = evaluateHealth({
    lastRunAt: new Date(now - 1000).toISOString(),
    lastStatus: 'success',
    consecutiveFailures: 0,
    lastDurationMs: 100,
  }, now);
  assert.equal(health.status, 'healthy');
  assert.equal(health.score, 100);
});

test('failed and stale runs reduce health', () => {
  const now = Date.now();
  const health = evaluateHealth({
    lastRunAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
    lastStatus: 'failed',
    consecutiveFailures: 3,
    lastDurationMs: 100,
  }, now);
  assert.equal(health.status, 'unhealthy');
  assert.ok(health.score < 40);
});

test('monitored records success, empty output, and thrown errors', async () => {
  const ok = monitor.monitored({ id: 'test-ok', name: 'Test OK', category: 'test' }, async () => [{ id: 1 }]);
  const empty = monitor.monitored({ id: 'test-empty', name: 'Test Empty', category: 'test' }, async () => []);
  const fail = monitor.monitored({ id: 'test-fail', name: 'Test Fail', category: 'test' }, async () => { throw new Error('upstream timeout'); });

  assert.deepEqual(await ok(), [{ id: 1 }]);
  assert.deepEqual(await empty(), []);
  await assert.rejects(fail(), /upstream timeout/);

  assert.equal(monitor.getScraper('test-ok').lastStatus, 'success');
  assert.equal(monitor.getScraper('test-ok').lastResultCount, 1);
  assert.equal(monitor.getScraper('test-empty').lastStatus, 'empty');
  assert.equal(monitor.getScraper('test-fail').lastStatus, 'failed');

  const runs = await monitor.getRuns('test-fail', 5);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].error.message, 'upstream timeout');
});

test('overview includes registered scrapers and status counts', async () => {
  const overview = await monitor.getOverview();
  assert.ok(overview.totals.scrapers >= 3);
  assert.ok(overview.totals.healthy >= 1);
});

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});
