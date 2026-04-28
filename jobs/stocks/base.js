const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const API_BASE_URL = 'https://api.28-markets.com/api';
const EXTERNAL_API_BASE = 'https://dev.kwayisi.org/apis/gse/live';
const SYMBOLS_FILE = path.join(__dirname, '..', '..', 'seed', 'gse.json');
const CONCURRENT_LIMIT = 2;
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

const GHANA_HOLIDAYS = [
  { month: 0, day: 1 },
  { month: 0, day: 7 },
  { month: 2, day: 6 },
  { month: 2, day: 20 },
  { month: 2, day: 21 },
  { month: 3, day: 3 },
  { month: 3, day: 6 },
  { month: 4, day: 1 },
  { month: 4, day: 27 },
  { month: 6, day: 1 },
  { month: 8, day: 21 },
  { month: 11, day: 4 },
  { month: 11, day: 25 },
  { month: 11, day: 26 },
];

const isGhanaHoliday = () => {
  const now = getCurrentGhanaTime();
  const date = new Date(now);
  const month = date.getMonth();
  const day = date.getDate();
  return GHANA_HOLIDAYS.some(
    (holiday) => holiday.month === month && holiday.day === day,
  );
};

const isWeekend = () => {
  const now = getCurrentGhanaTime();
  const date = new Date(now);
  const day = date.getDay();
  return day === 0 || day === 6;
};

const shouldRun = () => {
  if (isWeekend()) return false;
  if (isGhanaHoliday()) return false;
  return true;
};

async function loadSymbols() {
  try {
    const data = await fs.readFile(SYMBOLS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logWithTime(`❌ Failed to load symbols file: ${error.message}`);
    return [];
  }
}

async function fetchExternalData(symbol) {
  try {
    const response = await axios.get(`${EXTERNAL_API_BASE}/${symbol}`, {
      timeout: 20000,
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

async function getStatisticsByCompanyId(companyId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/equity/statistics/${companyId}`,
      {
        timeout: 15000,
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

async function addPriceEntry(companyId, price, date = null) {
  const payload = {
    price: price.toString(),
    date: date || new Date().toISOString(),
  };
  const response = await axios.post(
    `${API_BASE_URL}/stocks/equity/price-history/${companyId}/entries`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function updateLatestPrice(companyId, price) {
  const payload = {
    price: price.toString(),
  };
  const response = await axios.put(
    `${API_BASE_URL}/stocks/equity/price-history/${companyId}/latest`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function getPriceHistory(companyId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/equity/price-history/${companyId}`,
      {
        timeout: 15000,
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

async function processSymbol(symbolItem) {
  const symbol = symbolItem.symbol;

  try {
    const externalData = await fetchExternalData(symbol);
    logWithTime(
      `  ✓ Fetched ${symbol}: price=${externalData.price}, change=${externalData.change}, volume=${externalData.volume}`,
    );

    const currentPrice = parseFloat(externalData.price) || 0;
    const volume = externalData.volume || 0;
    const percentageChange = parseFloat(externalData.change) || 0;

    const updatePayload = {
      key_statistics: {
        volume: volume,
        percentage_change: percentageChange,
      },
    };

    const existingStats = await getStatisticsByCompanyId(symbol);

    if (existingStats) {
      await updateStatistics(symbol, updatePayload);
      logWithTime(`  ✓ Updated statistics for ${symbol}`);
    }

    if (currentPrice > 0) {
      const existingPriceHistory = await getPriceHistory(symbol);
      const oldPrice = existingStats?.data?.key_statistics?.current_price;

      if (!existingPriceHistory) {
        await addPriceEntry(symbol, currentPrice);
        logWithTime(
          `  ✓ Created price history for ${symbol} with initial price ${currentPrice}`,
        );
      } else {
        await updateLatestPrice(symbol, currentPrice);
        await addPriceEntry(symbol, currentPrice);
        logWithTime(
          `  ✓ Updated price for ${symbol} to ${currentPrice} and saved to history`,
        );
      }
    }

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
    if (error.response?.data) {
      logWithTime(`     Response: ${JSON.stringify(error.response.data)}`);
    }

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

async function scrapeAndUpdate() {
  if (!shouldRun()) {
    logWithTime('⏭️ Skipping run: Weekend or Ghana public holiday');
    return;
  }

  const runId = Date.now();
  const startTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(70));
  console.log(`🚀 GSE Live Data Scraper Run #${++totalRuns}`);
  console.log('='.repeat(70));
  console.log(`🕒 Start time: ${startTime}`);
  console.log(`📡 External API: ${EXTERNAL_API_BASE}/:symbol`);
  console.log(`🎯 Target API: ${API_BASE_URL}/stocks/equity`);
  console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT} symbols`);
  console.log('='.repeat(70));

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

  const symbols = await loadSymbols();
  if (symbols.length === 0) {
    console.log('❌ No symbols to process. Exiting.');
    return;
  }

  console.log(`📊 Loaded ${symbols.length} symbols from file\n`);

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

    results.forEach((r) => {
      if (r.success) runStats.successful++;
      else runStats.failed++;
    });

    if (i < batches.length - 1) {
      logWithTime(`⏱️  Waiting 2 seconds before next batch...`);
      await delay(2000);
    }
  }

  const successRate = ((runStats.successful / runStats.total) * 100).toFixed(1);
  const endTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(70));
  console.log(`📊 RUN SUMMARY - Run #${totalRuns}`);
  console.log('='.repeat(70));
  console.log(`🕒 Started: ${startTime}`);
  console.log(`🕒 Ended:   ${endTime}`);
  console.log(`📊 Total symbols: ${runStats.total}`);
  console.log(`✅ Successful: ${runStats.successful} (${successRate}%)`);
  console.log(`❌ Failed: ${runStats.failed}`);
  console.log('='.repeat(70));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(
    __dirname,
    `logs`,
    `gse-live-run-${timestamp}.json`,
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
  console.log('='.repeat(70) + '\n');
}

cron.schedule(
  '*/30 10-15 * * 1-5',
  () => {
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();

    if (currentHour === 15 && currentMinute > 30) {
      return;
    }

    logWithTime('⏰ Running scheduled job');
    scrapeAndUpdate().catch((err) => {
      logWithTime(`💥 Fatal error: ${err.message}`);
    });
  },
  { timezone: TIMEZONE },
);

console.log('='.repeat(70));
console.log('🚀 GSE Live Data Scraper Service Started');
console.log('='.repeat(70));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentGhanaTime()}`);
console.log(`📡 External API: ${EXTERNAL_API_BASE}`);
console.log(`🎯 Target API: ${API_BASE_URL}/stocks/equity`);
console.log(`📋 Symbols file: ${SYMBOLS_FILE}`);
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`);
console.log(
  `⏰ Schedule: Every 30 minutes from 10:00 AM to 3:30 PM, Monday-Friday`,
);
console.log(`🎉 Holiday detection: Enabled (Ghana public holidays skipped)`);
console.log('='.repeat(70) + '\n');

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down GSE live scraper service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down GSE live scraper service...');
  process.exit(0);
});

module.exports = { scrapeAndUpdate };
