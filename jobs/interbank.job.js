const cron = require('node-cron');
const axios = require('axios');
const interbankScraper = require('../scripts/interbank/rates');

const API_BASE_URL = 'https://api.28-markets.com/api';
const MAX_WAIT_MS = 5 * 60 * 1000;
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

const getCurrentGhanaTime = () => {
  return new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
};

const logWithTime = (message) => {
  console.log(`[${getCurrentGhanaTime()}] ${message}`);
};

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
    ),
  ]);
};

const currencyMap = {
  USD: { name: 'US Dollar', currency: 'US Dollar' },
  EUR: { name: 'Euro', currency: 'Euro' },
  GBP: { name: 'British Pound', currency: 'British Pound Sterling' },
};

const getCurrencyInfo = (code) => {
  return (
    currencyMap[code] || {
      name: code,
      currency: code,
    }
  );
};

const transformScrapedData = (scrapedRate) => {
  const currencyPair = scrapedRate.currency_pair;

  let fromCode, toCode;

  if (currencyPair.includes('/')) {
    const parts = currencyPair.split('/');
    fromCode = parts[0].trim().toUpperCase();
    toCode = parts[1].trim().toUpperCase();
  } else {
    fromCode = currencyPair.substring(0, 3).toUpperCase();
    toCode = currencyPair.substring(3).toUpperCase();
  }

  const fromInfo = getCurrencyInfo(fromCode);
  const toInfo = getCurrencyInfo(toCode);

  const code = `${fromCode}${toCode}`;
  const bankCode = `BOG${code}`;
  const name = `${fromInfo.name} to ${toInfo.name}`;

  return {
    bankName: 'Bank of Ghana',
    bankCode: bankCode,
    code: code,
    name: name,
    from_currency: fromInfo.currency,
    from_code: fromCode,
    to_currency: toInfo.currency,
    to_code: toCode,
    current_buying_price: scrapedRate.buying_rate,
    current_selling_price: scrapedRate.selling_rate,
    current_midrate_price: scrapedRate.mid_rate,
    date: scrapedRate.date,
  };
};

async function getInterbankPairByBankCode(bankCode) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/forex-interbank-rates/interbank-pairs/bank/${bankCode}`,
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

async function createInterbankPair(pairData) {
  const payload = {
    bankName: pairData.bankName,
    bankCode: pairData.bankCode,
    code: pairData.code,
    name: pairData.name,
    from_currency: pairData.from_currency,
    from_code: pairData.from_code,
    to_currency: pairData.to_currency,
    to_code: pairData.to_code,
    current_buying_price: pairData.current_buying_price,
    current_selling_price: pairData.current_selling_price,
    current_midrate_price: pairData.current_midrate_price,
  };

  const response = await axios.post(
    `${API_BASE_URL}/forex-interbank-rates/interbank-pairs`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function updatePrices(pairId, priceData) {
  const payload = {
    current_buying_price: priceData.current_buying_price,
    current_selling_price: priceData.current_selling_price,
    current_midrate_price: priceData.current_midrate_price,
    buying_percentage_change: priceData.buying_percentage_change,
    selling_percentage_change: priceData.selling_percentage_change,
    midrate_percentage_change: priceData.midrate_percentage_change,
    last_updated: new Date().toISOString(),
  };

  const response = await axios.put(
    `${API_BASE_URL}/forex-interbank-rates/interbank-pairs/${pairId}/prices`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function addPriceHistory(bankCode, priceData) {
  const payload = {
    buying_price: priceData.current_buying_price,
    selling_price: priceData.current_selling_price,
    midrate_price: priceData.current_midrate_price,
    date: new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/forex-interbank-rates/interbank-pairs/${bankCode}/history`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

async function getPriceHistory(bankCode) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/forex-interbank-rates/price-history/${bankCode}/latest`,
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

const calculatePercentageChange = (oldValue, newValue) => {
  if (!oldValue || oldValue === 0) return 0;
  return parseFloat((((newValue - oldValue) / oldValue) * 100).toFixed(4));
};

async function processInterbankUpdate(scrapedData) {
  const start = Date.now();
  try {
    const existingPair = await getInterbankPairByBankCode(scrapedData.bankCode);

    const buyingChange = existingPair
      ? calculatePercentageChange(
          existingPair.current_buying_price,
          scrapedData.current_buying_price,
        )
      : 0;

    const sellingChange = existingPair
      ? calculatePercentageChange(
          existingPair.current_selling_price,
          scrapedData.current_selling_price,
        )
      : 0;

    const midrateChange = existingPair
      ? calculatePercentageChange(
          existingPair.current_midrate_price,
          scrapedData.current_midrate_price,
        )
      : 0;

    if (!existingPair) {
      const newPair = await createInterbankPair(scrapedData);
      await addPriceHistory(scrapedData.bankCode, scrapedData);
      logWithTime(
        `  ✓ Created ${scrapedData.code} with prices: B=${scrapedData.current_buying_price}, S=${scrapedData.current_selling_price}, M=${scrapedData.current_midrate_price}`,
      );
      return {
        code: scrapedData.code,
        bankCode: scrapedData.bankCode,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    await updatePrices(existingPair._id, {
      current_buying_price: scrapedData.current_buying_price,
      current_selling_price: scrapedData.current_selling_price,
      current_midrate_price: scrapedData.current_midrate_price,
      buying_percentage_change: buyingChange,
      selling_percentage_change: sellingChange,
      midrate_percentage_change: midrateChange,
    });

    await addPriceHistory(scrapedData.bankCode, scrapedData);

    logWithTime(
      `  ✓ Updated ${scrapedData.code}: B: ${existingPair.current_buying_price}→${scrapedData.current_buying_price} (${buyingChange}%), S: ${existingPair.current_selling_price}→${scrapedData.current_selling_price} (${sellingChange}%), M: ${existingPair.current_midrate_price}→${scrapedData.current_midrate_price} (${midrateChange}%)`,
    );

    return {
      code: scrapedData.code,
      bankCode: scrapedData.bankCode,
      action: 'updated',
      oldBuying: existingPair.current_buying_price,
      newBuying: scrapedData.current_buying_price,
      oldSelling: existingPair.current_selling_price,
      newSelling: scrapedData.current_selling_price,
      oldMidrate: existingPair.current_midrate_price,
      newMidrate: scrapedData.current_midrate_price,
      buyingChange: buyingChange,
      sellingChange: sellingChange,
      midrateChange: midrateChange,
      duration: Date.now() - start,
    };
  } catch (error) {
    logWithTime(`  ✗ Failed for ${scrapedData.code}: ${error.message}`);
    return {
      code: scrapedData.code,
      bankCode: scrapedData.bankCode,
      error: error.response?.data?.message || error.message,
    };
  }
}

async function scrapeAndUpdate() {
  const runId = Date.now();
  const startTime = getCurrentGhanaTime();

  console.log('\n' + '='.repeat(80));
  console.log(`🚀 Forex Interbank Scraper Run #${++totalRuns}`);
  console.log('='.repeat(80));
  console.log(`🕒 Start time: ${startTime}`);
  console.log(`🎯 Target API: ${API_BASE_URL}/forex-interbank-rates`);
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

  try {
    const scrapedResult = await withTimeout(
      interbankScraper,
      MAX_WAIT_MS,
      'Bank of Ghana scraper',
    );

    if (!scrapedResult || scrapedResult.error) {
      console.log('❌ No data received from scraper');
      return;
    }

    const currencyPairs = ['GBPGHS', 'USDGHS', 'EURGHS'];
    const validData = [];

    for (const pair of currencyPairs) {
      if (scrapedResult[pair] && scrapedResult[pair].length > 0) {
        validData.push(transformScrapedData(scrapedResult[pair][0]));
      }
    }

    if (validData.length === 0) {
      console.log('❌ No valid currency pairs found');
      return;
    }

    console.log(`📊 Processing ${validData.length} currency pairs\n`);

    const results = await Promise.all(validData.map(processInterbankUpdate));

    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;

    todayStats.successful += successful;
    todayStats.failed += failed;

    results.forEach((r) => {
      if (!r.error) {
        todayStats.details.push({
          code: r.code,
          bankCode: r.bankCode,
          action: r.action,
          data: {
            buying_price: r.newBuying || r.newBuying,
            selling_price: r.newSelling || r.newSelling,
            midrate_price: r.newMidrate || r.newMidrate,
          },
          time: getCurrentGhanaTime(),
        });
      } else {
        todayStats.details.push({
          code: r.code,
          bankCode: r.bankCode,
          error: r.error,
          time: getCurrentGhanaTime(),
        });
      }
    });

    const endTime = getCurrentGhanaTime();

    console.log('\n' + '='.repeat(80));
    console.log(`📊 RUN SUMMARY - Run #${totalRuns}`);
    console.log('='.repeat(80));
    console.log(`🕒 Started: ${startTime}`);
    console.log(`🕒 Ended:   ${endTime}`);
    console.log(`📊 Total pairs: ${validData.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Created: ${created}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error(`💥 Job failed: ${error.message}`);
  }
}

const interbankUpdateJob = cron.schedule(
  '0 0 * * 1-5',
  async () => {
    logWithTime('⏰ Scheduled: Daily interbank update (12:00 AM)');
    await scrapeAndUpdate();
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  },
);

console.log('='.repeat(80));
console.log('🚀 Forex Interbank Scraper Service Started');
console.log('='.repeat(80));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentGhanaTime()}`);
console.log(`🎯 Target API: ${API_BASE_URL}/forex-interbank-rates`);
console.log('\n⏰ Scheduled runs (Monday-Friday only):');
console.log('  - 12:00 AM (Daily update)');
console.log('='.repeat(80) + '\n');

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down forex interbank scraper service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down forex interbank scraper service...');
  process.exit(0);
});

module.exports = { interbankUpdateJob, scrapeAndUpdate };
