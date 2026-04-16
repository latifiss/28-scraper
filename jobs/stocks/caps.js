const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

// Import all scrapers
const gseSources = require('../../scripts/equity/stocks/ghana/index');

// ==================== CONFIGURATION ====================
const YOUR_API_BASE = 'http://localhost:6060/api/stocks/equity/statistics';
const CONCURRENT_LIMIT = 3;
const REQUEST_TIMEOUT = 30000;
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

// ==================== PARSE FUNCTIONS ====================
const parseYearChange = (changeStr) => {
  if (!changeStr) return 0;
  const match = changeStr.match(/([+-]?\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
};

const parse52WeekRange = (rangeStr) => {
  const result = { high: 0, low: 0 };
  if (!rangeStr) return result;
  const parts = rangeStr.split('-').map((p) => p.trim());
  if (parts.length === 2) {
    result.low = parseFloat(parts[0]) || 0;
    result.high = parseFloat(parts[1]) || 0;
  }
  return result;
};

const parseMarketCap = (marketCapStr) => {
  if (!marketCapStr) return '0';
  const match = marketCapStr.match(/([\d.]+)([BMK]?)/i);
  if (!match) return marketCapStr;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'B') return `${value * 1000000000}`;
  if (unit === 'M') return `${value * 1000000}`;
  if (unit === 'K') return `${value * 1000}`;
  return `${value}`;
};

// ==================== UPDATE BACKEND ====================
async function updateBackend(symbol, scrapedData) {
  try {
    const quote = scrapedData.quoteSnapshot || {};

    // Parse only the fields we need
    const yearChange = parseYearChange(quote['1 Year change']);
    const weekRange = parse52WeekRange(quote['52 week range']);
    const marketCap = parseMarketCap(quote['Market Cap (GHS)']);

    // Create payload with ONLY the specific fields
    const payload = {
      returns: {
        one_year_returns: yearChange,
      },
      key_statistics: {
        fifty_two_week_high: weekRange.high,
        fifty_two_week_low: weekRange.low,
      },
      growth_valuation: {
        market_capitalization: marketCap,
      },
    };

    // Remove returns if value is 0 and no data
    if (payload.returns.one_year_returns === 0 && !quote['1 Year change']) {
      delete payload.returns;
    }

    // Remove growth_valuation if market cap is 0 and no data
    if (
      payload.growth_valuation.market_capitalization === '0' &&
      !quote['Market Cap (GHS)']
    ) {
      delete payload.growth_valuation;
    }

    // Only send if there's at least one field to update
    if (Object.keys(payload).length === 0) {
      logWithTime(`  ⏭️  No data to update for ${symbol}`);
      return;
    }

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

// ==================== PROCESS SINGLE STOCK ====================
async function processStock(scraperFunction, index, total) {
  const scraperName = scraperFunction.name || `Scraper-${index}`;

  try {
    logWithTime(`  🔄 [${index}/${total}] Running ${scraperName}...`);

    // Run the scraper
    const scrapedData = await scraperFunction();

    if (scrapedData.error) {
      throw new Error(scrapedData.error);
    }

    if (!scrapedData.symbol) {
      throw new Error('No symbol found in scraped data');
    }

    logWithTime(`  ✓ Fetched data for ${scrapedData.symbol}`);

    // Update backend with only the specific fields
    await updateBackend(scrapedData.symbol, scrapedData);

    // Log extracted values
    const quote = scrapedData.quoteSnapshot || {};
    logWithTime(
      `     📈 1 Year Change: ${quote['1 Year change'] || 'N/A'} → ${parseYearChange(quote['1 Year change'])}`,
    );
    logWithTime(
      `     📊 52 Week Range: ${quote['52 week range'] || 'N/A'} → low: ${parse52WeekRange(quote['52 week range']).low}, high: ${parse52WeekRange(quote['52 week range']).high}`,
    );
    logWithTime(
      `     💰 Market Cap: ${quote['Market Cap (GHS)'] || 'N/A'} → ${parseMarketCap(quote['Market Cap (GHS)'])}`,
    );

    todayStats.successful++;
    todayStats.details.push({
      symbol: scrapedData.symbol,
      status: 'success',
      data: {
        one_year_returns: parseYearChange(quote['1 Year change']),
        fifty_two_week_low: parse52WeekRange(quote['52 week range']).low,
        fifty_two_week_high: parse52WeekRange(quote['52 week range']).high,
        market_capitalization: parseMarketCap(quote['Market Cap (GHS)']),
      },
      time: getCurrentGhanaTime(),
    });

    return { symbol: scrapedData.symbol, success: true };
  } catch (error) {
    logWithTime(`  ✗ Failed: ${error.message}`);

    todayStats.failed++;
    todayStats.details.push({
      scraper: scraperName,
      status: 'failed',
      error: error.message,
      time: getCurrentGhanaTime(),
    });

    return { success: false, error: error.message };
  }
}

// ==================== MAIN SCRAPING FUNCTION ====================
async function scrapeAndUpdateAll() {
  const runId = Date.now();
  const startTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(80));
  console.log(`🚀 GSE Stock Data Scraper Run #${++totalRuns}`);
  console.log('='.repeat(80));
  console.log(`🕒 Start time: ${startTime}`);
  console.log(`🎯 Target API: ${YOUR_API_BASE}/:symbol`);
  console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT} stocks`);
  console.log(`📊 Total scrapers: ${gseSources.length}`);
  console.log('='.repeat(80));

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

  // Process in batches
  const runStats = {
    total: gseSources.length,
    successful: 0,
    failed: 0,
  };

  const batches = [];
  for (let i = 0; i < gseSources.length; i += CONCURRENT_LIMIT) {
    batches.push(gseSources.slice(i, i + CONCURRENT_LIMIT));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startIdx = i * CONCURRENT_LIMIT + 1;

    console.log(
      `\n📦 Batch ${i + 1}/${batches.length} (${batch.length} stocks)`,
    );

    const promises = batch.map((scraper, idx) =>
      processStock(scraper, startIdx + idx, gseSources.length),
    );

    const results = await Promise.all(promises);

    // Update run stats
    results.forEach((r) => {
      if (r.success) runStats.successful++;
      else runStats.failed++;
    });

    // Small delay between batches
    if (i < batches.length - 1) {
      logWithTime(`⏱️  Waiting 3 seconds before next batch...`);
      await delay(3000);
    }
  }

  // Calculate success rate
  const successRate = ((runStats.successful / runStats.total) * 100).toFixed(1);
  const endTime = getCurrentGhanaTime();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log(`📊 RUN SUMMARY - Run #${totalRuns}`);
  console.log('='.repeat(80));
  console.log(`🕒 Started: ${startTime}`);
  console.log(`🕒 Ended:   ${endTime}`);
  console.log(`📊 Total stocks: ${runStats.total}`);
  console.log(`✅ Successful: ${runStats.successful} (${successRate}%)`);
  console.log(`❌ Failed: ${runStats.failed}`);
  console.log('='.repeat(80));

  // Save detailed results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(
    __dirname,
    'logs',
    `gse-stocks-run-${timestamp}.json`,
  );

  // Create logs directory if it doesn't exist
  try {
    await fs.mkdir(path.join(__dirname, 'logs'), { recursive: true });
  } catch (err) {}

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
  console.log('='.repeat(80) + '\n');

  return runStats;
}

// ==================== SCHEDULED JOBS ====================
// Run at 10:10 AM on weekdays
cron.schedule(
  '10 10 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 10:10 AM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

// Run at 12:10 PM on weekdays
cron.schedule(
  '10 12 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 12:10 PM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

// Run at 3:10 PM on weekdays
cron.schedule(
  '10 15 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 3:10 PM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

// ==================== STARTUP ====================
console.log('='.repeat(80));
console.log('🚀 GSE Stock Data Scraper Service Started');
console.log('='.repeat(80));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentGhanaTime()}`);
console.log(`🎯 Target API: ${YOUR_API_BASE}`);
console.log(`📊 Total scrapers loaded: ${gseSources.length}`);
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`);
console.log('\n⏰ Scheduled runs (Monday-Friday only):');
console.log('  - 10:10 AM (Mid-morning update)');
console.log('  - 12:10 PM (Mid-day update)');
console.log('  - 3:10 PM (After market close)');
console.log('='.repeat(80) + '\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down GSE stock scraper service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down GSE stock scraper service...');
  process.exit(0);
});

module.exports = { scrapeAndUpdateAll };
