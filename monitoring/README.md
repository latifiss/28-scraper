# Scraper health monitoring

The monitoring module observes real scraper executions. It does not make extra requests to upstream websites, so it does not add load or risk triggering source anti-bot systems.

## API

All endpoints are mounted at `/api/monitoring`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Fleet overview and per-scraper health |
| GET | `/scrapers` | Registry and current health for each registered scraper |
| GET | `/scrapers/:id` | One scraper's metrics and health |
| GET | `/scrapers/:id/runs?limit=50` | Recent execution history for one scraper |
| GET | `/runs?limit=50` | Recent execution history across the fleet |

Set `SCRAPER_MONITORING_API_KEY` to require the key through `x-monitoring-key` or `Authorization: Bearer <key>`. If unset, endpoints are read-only and publicly accessible; configure a key before exposing operational details publicly.

## Persistence and configuration

Execution history is appended to `data/monitoring/runs.jsonl` by default. Set `SCRAPER_MONITORING_DIR` to a persistent writable volume in production. On ephemeral/container deployments, mount a persistent volume or provide an external store before expecting history to survive redeployments.

- `SCRAPER_MONITORING_API_KEY`: optional API key.
- `SCRAPER_MONITORING_DIR`: history directory.
- `SCRAPER_MONITORING_MEMORY_RUNS`: in-memory history cap (default 2000).
- `SCRAPER_STALE_AFTER_MS`: default staleness window (default 2 hours).

## Health model

- `unknown`: no run recorded yet.
- `healthy`: latest run returned usable data and is within its freshness window.
- `degraded`: latest run was empty, data is stale, or the score is below 80.
- `unhealthy`: latest run failed, three or more consecutive failures occurred, or score is below 40.

The 0-100 score is explainable: failed latest run (-60), each consecutive failure (-10, capped at -30), empty result (-35), stale run (-30), and execution over its configured timeout (-10). A zero-row result is recorded as `empty`, not silently treated as a successful scrape.

## Instrumenting a scraper

Use the wrapper at the boundary where the scraper function is invoked:

```js
const { monitored } = require('../monitoring');
const trackedFetch = monitored({
  id: 'crypto-bitcoin',
  name: 'Bitcoin',
  category: 'cryptocurrency',
  source: 'CoinGecko',
  expectedIntervalMs: 10 * 60 * 1000,
}, fetchBitcoin);
```

The commodity, forex, crypto, and index source arrays are instrumented centrally. Add the wrapper to new source arrays and to individually-invoked scrapers as they are introduced. Job-level processing/API synchronization should be monitored separately from source scraping so source failures are not confused with downstream API failures.

## Important limitations

A scraper returning an empty array is marked degraded because the monitor cannot infer whether zero results are expected for that source. Add source-specific validators and market-hours/calendar awareness before treating empty output as a definitive source outage. The first version measures observed execution, duration, result count, thrown/returned errors and history; it does not independently probe source reachability, validate financial values, or prove downstream API persistence.
