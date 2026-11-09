const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.SCRAPER_MONITORING_DIR || path.join(process.cwd(), 'data', 'monitoring');
const RUNS_FILE = path.join(DATA_DIR, 'runs.jsonl');
const MAX_MEMORY_RUNS = Number(process.env.SCRAPER_MONITORING_MEMORY_RUNS || 2000);

let writeQueue = Promise.resolve();

function ensureDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function appendRun(run) {
  writeQueue = writeQueue.then(async () => {
    ensureDirectory();
    await fs.promises.appendFile(RUNS_FILE, JSON.stringify(run) + '\n', 'utf8');
  });
  return writeQueue;
}

async function readRuns(limit = 500, scraperId = null) {
  try {
    ensureDirectory();
    const raw = await fs.promises.readFile(RUNS_FILE, 'utf8');
    const rows = raw.split('\n').filter(Boolean);
    const parsed = [];
    for (let i = rows.length - 1; i >= 0 && parsed.length < Math.min(limit * 5, MAX_MEMORY_RUNS); i--) {
      try {
        const run = JSON.parse(rows[i]);
        if (!scraperId || run.scraperId === scraperId) parsed.push(run);
      } catch (_) { /* Ignore a partially-written/corrupt historical line. */ }
    }
    return parsed.slice(0, limit);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = { appendRun, readRuns, DATA_DIR };
