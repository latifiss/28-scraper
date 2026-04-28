const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const gseSources = require('../../scripts/equity/stocks/ghana/index');

const API_BASE_URL = 'https://api.28-markets.com/api';
const CONCURRENT_LIMIT = 3;
const REQUEST_TIMEOUT = 30000;
const TIMEZONE = 'Africa/Accra';

let totalRuns = 0;
let todayStats = {
  date: new Date().toDateString(),
  runs: 0,
  successful: 0,
  failed: 0,
  details: [],
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCurrentGhanaTime = () => {
  return new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
};

const logWithTime = (message) => {
  console.log(`[${getCurrentGhanaTime()}] ${message}`);
};

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

async function getStatisticsByCompanyId(companyId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/equity/statistics/${companyId}`,
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function updateStatistics(companyId, payload) {
  const response = await axios.put(
    `${API_BASE_URL}/stocks/equity/statistics/${companyId}`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function processStock(scraperFunction, index, total) {
  const start = Date.now();
  const scraperName = scraperFunction.name || `Scraper-${index}`;

  try {
    logWithTime(`  🔄 [${index}/${total}] Running ${scraperName}...`);

    const scrapedData = await scraperFunction();

    if (scrapedData.error) {
      throw new Error(scrapedData.error);
    }

    if (!scrapedData.symbol) {
      throw new Error('No symbol found in scraped data');
    }

    const companyId = scrapedData.symbol;
    const quote = scrapedData.quoteSnapshot || {};

    logWithTime(`  ✓ Fetched data for ${scrapedData.symbol}`);

    const existingStats = await getStatisticsByCompanyId(companyId);

    if (!existingStats) {
      logWithTime(
        `  ⚠️ Statistics not found for ${companyId}, skipping update`,
      );
      return {
        symbol: scrapedData.symbol,
        success: false,
        error: 'Statistics not found',
      };
    }

    const yearChange = parseYearChange(quote['1 Year change']);
    const weekRange = parse52WeekRange(quote['52 week range']);
    const marketCap = parseMarketCap(quote['Market Cap (GHS)']);

    const updatePayload = {};

    if (yearChange !== 0) {
      updatePayload.returns = {
        one_year_returns: yearChange,
      };
    }

    if (weekRange.high !== 0 || weekRange.low !== 0) {
      if (!updatePayload.key_statistics) {
        updatePayload.key_statistics = {};
      }
      updatePayload.key_statistics.fifty_two_week_high = weekRange.high;
      updatePayload.key_statistics.fifty_two_week_low = weekRange.low;
    }

    if (marketCap !== '0') {
      if (!updatePayload.growth_valuation) {
        updatePayload.growth_valuation = {};
      }
      updatePayload.growth_valuation.market_capitalization = marketCap;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateStatistics(companyId, updatePayload);
      logWithTime(`  ✓ Updated statistics for ${scrapedData.symbol}`);
    } else {
      logWithTime(`  ⏭️ No new data to update for ${scrapedData.symbol}`);
    }

    logWithTime(
      `     📈 1 Year Change: ${quote['1 Year change'] || 'N/A'} → ${yearChange}`,
    );
    logWithTime(
      `     📊 52 Week Range: ${quote['52 week range'] || 'N/A'} → low: ${weekRange.low}, high: ${weekRange.high}`,
    );
    logWithTime(
      `     💰 Market Cap: ${quote['Market Cap (GHS)'] || 'N/A'} → ${marketCap}`,
    );

    todayStats.successful++;
    todayStats.details.push({
      symbol: scrapedData.symbol,
      status: 'success',
      data: {
        one_year_returns: yearChange,
        fifty_two_week_low: weekRange.low,
        fifty_two_week_high: weekRange.high,
        market_capitalization: marketCap,
      },
      time: getCurrentGhanaTime(),
    });

    return {
      symbol: scrapedData.symbol,
      success: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    logWithTime(`  ✗ Failed for ${scraperName}: ${error.message}`);
    if (error.response?.data) {
      logWithTime(`     Response: ${JSON.stringify(error.response.data)}`);
    }

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

async function scrapeAndUpdateAll() {
  const runId = Date.now();
  const startTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(80));
  console.log(`🚀 GSE Stock Data Scraper Run #${++totalRuns}`);
  console.log('='.repeat(80));
  console.log(`🕒 Start time: ${startTime}`);
  console.log(`🎯 Target API: ${API_BASE_URL}/stocks/equity`);
  console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT} stocks`);
  console.log(`📊 Total scrapers: ${gseSources.length}`);
  console.log('='.repeat(80));

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

    results.forEach((r) => {
      if (r && r.success) runStats.successful++;
      else runStats.failed++;
    });

    if (i < batches.length - 1) {
      logWithTime(`⏱️  Waiting 3 seconds before next batch...`);
      await delay(3000);
    }
  }

  const successRate =
    runStats.total > 0
      ? ((runStats.successful / runStats.total) * 100).toFixed(1)
      : '0';
  const endTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(80));
  console.log(`📊 RUN SUMMARY - Run #${totalRuns}`);
  console.log('='.repeat(80));
  console.log(`🕒 Started: ${startTime}`);
  console.log(`🕒 Ended:   ${endTime}`);
  console.log(`📊 Total stocks: ${runStats.total}`);
  console.log(`✅ Successful: ${runStats.successful} (${successRate}%)`);
  console.log(`❌ Failed: ${runStats.failed}`);
  console.log('='.repeat(80));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(
    __dirname,
    'logs',
    `gse-stocks-run-${timestamp}.json`,
  );

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

cron.schedule(
  '0 10,12,15 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 10:00 AM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

cron.schedule(
  '0 12 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 12:10 PM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

cron.schedule(
  '0 15 * * 1-5',
  () => {
    logWithTime('⏰ Scheduled: 3:10 PM run started');
    scrapeAndUpdateAll().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

console.log('='.repeat(80));
console.log('🚀 GSE Stock Data Scraper Service Started');
console.log('='.repeat(80));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentGhanaTime()}`);
console.log(`🎯 Target API: ${API_BASE_URL}/stocks/equity`);
console.log(`📊 Total scrapers loaded: ${gseSources.length}`);
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`);
console.log('\n⏰ Scheduled runs (Monday-Friday only):');
console.log('  - 10:00 AM (Mid-morning update)');
console.log('  - 12:10 PM (Mid-day update)');
console.log('  - 3:10 PM (After market close)');
console.log('='.repeat(80) + '\n');

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down GSE stock scraper service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down GSE stock scraper service...');
  process.exit(0);
});

module.exports = { scrapeAndUpdateAll };
