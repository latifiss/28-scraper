const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

// ==================== CONFIGURATION ====================
const EXTERNAL_API_BASE = 'https://dev.kwayisi.org/apis/gse/live';
const YOUR_API_BASE = 'http://localhost:6060/api/stocks/equity/statistics';
const SYMBOLS_FILE = path.join(__dirname, 'seed', 'gse.json');
const CONCURRENT_LIMIT = 5;
const REQUEST_TIMEOUT = 10000;
const TIMEZONE = 'Africa/Accra';

// Stats tracking
let totalRuns = 0;
let todayStats = {
  date: new Date().toDateString(),
  runs: 0,
  successful: 0,
  failed: 0,
  details: [],
};

// ==================== UTILITY FUNCTIONS ====================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCurrentGhanaTime = () => {
  return new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
};

const logWithTime = (message) => {
  console.log(`[${getCurrentGhanaTime()}] ${message}`);
};

// ==================== LOAD SYMBOLS ====================
async function loadSymbols() {
  try {
    const data = await fs.readFile(SYMBOLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logWithTime(`❌ Failed to load symbols file: ${error.message}`);
    return [];
  }
}

// ==================== FETCH EXTERNAL DATA ====================
async function fetchExternalData(symbol) {
  try {
    const response = await axios.get(`${EXTERNAL_API_BASE}/${symbol}`, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GSE-Data-Scraper/1.0',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`External API error: ${error.message}`);
  }
}

// ==================== UPDATE BACKEND ====================
async function updateBackend(symbol, data) {
  try {
    const payload = {
      key_statistics: {
        current_price: data.price?.toString() || '0',
        volume: data.volume || 0,
        percentage_change: data.change || 0,
      },
    };

    const response = await axios.put(`${YOUR_API_BASE}/${symbol}`, payload, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(`Backend API error: ${error.message}`);
  }
}

// ==================== PROCESS SINGLE SYMBOL ====================
async function processSymbol(symbolItem) {
  const symbol = symbolItem.symbol;

  try {
    // Fetch from external API
    const externalData = await fetchExternalData(symbol);
    logWithTime(
      `  ✓ Fetched ${symbol}: price=${externalData.price}, change=${externalData.change}, volume=${externalData.volume}`,
    );

    // Update your backend
    await updateBackend(symbol, externalData);
    logWithTime(`  ✓ Updated ${symbol} in database`);

    todayStats.successful++;
    todayStats.details.push({
      symbol,
      status: 'success',
      data: externalData,
      time: getCurrentGhanaTime(),
    });

    return { symbol, success: true, data: externalData };
  } catch (error) {
    logWithTime(`  ✗ Failed for ${symbol}: ${error.message}`);

    todayStats.failed++;
    todayStats.details.push({
      symbol,
      status: 'failed',
      error: error.message,
      time: getCurrentGhanaTime(),
    });

    return { symbol, success: false, error: error.message };
  }
}

// ==================== MAIN SCRAPING FUNCTION ====================
async function scrapeAndUpdate() {
  const runId = Date.now();
  const startTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(70));
  console.log(`🚀 GSE Live Data Scraper Run #${++totalRuns}`);
  console.log('='.repeat(70));
  console.log(`🕒 Start time: ${startTime}`);
  console.log(`📡 External API: ${EXTERNAL_API_BASE}/:symbol`);
  console.log(`🎯 Target API: ${YOUR_API_BASE}/:symbol`);
  console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT} symbols`);
  console.log('='.repeat(70));

  // Reset daily stats if it's a new day
  const today = new Date().toDateString();
  if (todayStats.date !== today) {
    todayStats = {
      date: today,
      runs: 0,
      successful: 0,
      failed: 0,
      details: [],
    };
  }
  todayStats.runs++;

  // Load symbols
  const symbols = await loadSymbols();
  if (symbols.length === 0) {
    console.log('❌ No symbols to process. Exiting.');
    return;
  }

  console.log(`📊 Loaded ${symbols.length} symbols from file\n`);

  // Process in batches
  const runStats = {
    total: symbols.length,
    successful: 0,
    failed: 0,
  };

  const batches = [];
  for (let i = 0; i < symbols.length; i += CONCURRENT_LIMIT) {
    batches.push(symbols.slice(i, i + CONCURRENT_LIMIT));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `\n📦 Batch ${i + 1}/${batches.length} (${batch.length} symbols)`,
    );

    const promises = batch.map((symbolItem) => processSymbol(symbolItem));
    const results = await Promise.all(promises);

    // Update run stats
    results.forEach((r) => {
      if (r.success) runStats.successful++;
      else runStats.failed++;
    });

    // Small delay between batches (except last batch)
    if (i < batches.length - 1) {
      logWithTime(`⏱️  Waiting 2 seconds before next batch...`);
      await delay(2000);
    }
  }

  // Calculate success rate
  const successRate = ((runStats.successful / runStats.total) * 100).toFixed(1);
  const endTime = getCurrentGhanaTime();

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log(`📊 RUN SUMMARY - Run #${totalRuns}`);
  console.log('='.repeat(70));
  console.log(`🕒 Started: ${startTime}`);
  console.log(`🕒 Ended:   ${endTime}`);
  console.log(`📊 Total symbols: ${runStats.total}`);
  console.log(`✅ Successful: ${runStats.successful} (${successRate}%)`);
  console.log(`❌ Failed: ${runStats.failed}`);
  console.log('='.repeat(70));

  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(__dirname, `logs`, `gse-run-${timestamp}.json`);

  // Create logs directory if it doesn't exist
  try {
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
  } catch (err) {
    // Directory already exists
  }

  const runResult = {
    runId,
    startTime,
    endTime,
    stats: runStats,
    details: todayStats.details.filter(
      (d) => d.time >= startTime && d.time <= endTime,
    ),
  };

  await fs.writeFile(resultsFile, JSON.stringify(runResult, null, 2));
  console.log(`💾 Run details saved to: ${resultsFile}`);
  console.log('='.repeat(70) + '\n');
}

// ==================== SCHEDULED JOBS ====================
// Run at 10:05 AM on weekdays (Monday-Friday)
cron.schedule(
  '5 10 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 10:05 AM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 10:05 AM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 11:05 AM on weekdays
cron.schedule(
  '5 11 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 11:05 AM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 11:05 AM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 12:05 PM on weekdays
cron.schedule(
  '5 12 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 12:05 PM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 12:05 PM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 1:05 PM on weekdays
cron.schedule(
  '5 13 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 1:05 PM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 1:05 PM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 2:05 PM on weekdays
cron.schedule(
  '5 14 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 2:05 PM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 2:05 PM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// Run at 3:05 PM on weekdays
cron.schedule(
  '5 15 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 3:05 PM run started');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error in 3:05 PM run: ${err.message}`);
    });
  },
  {
    timezone: TIMEZONE,
  },
);

// ==================== STARTUP ====================
console.log('='.repeat(70));
console.log('🚀 GSE Live Data Scraper Service Started');
console.log('='.repeat(70));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentGhanaTime()}`);
console.log(`📡 External API: ${EXTERNAL_API_BASE}`);
console.log(`🎯 Target API: ${YOUR_API_BASE}`);
console.log(`📋 Symbols file: ${SYMBOLS_FILE}`);
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`);
console.log('\n⏰ Scheduled runs (Monday-Friday only):');
console.log('  - 10:05 AM');
console.log('  - 11:05 AM');
console.log('  - 12:05 PM');
console.log('  - 1:05 PM');
console.log('  - 2:05 PM');
console.log('  - 3:05 PM');
console.log('='.repeat(70) + '\n');

// Run once immediately on startup (optional)
// Uncomment the next line if you want an immediate run when starting the service
// setTimeout(() => scrapeAndUpdate(), 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down GSE scraper service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down GSE scraper service...');
  process.exit(0);
});
