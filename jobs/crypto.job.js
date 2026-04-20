const cron = require('node-cron');
const axios = require('axios');
const cryptoSources = require('../scripts/cryptoIndex');

const API_BASE_URL = 'http://localhost:6060/api';
const REQUEST_TIMEOUT = 120000;
const TIMEZONE = 'UTC';

let totalRuns = 0;
let todayStats = {
  date: new Date().toDateString(),
  runs: 0,
  successful: 0,
  failed: 0,
  details: [],
};

const getCurrentUTC = () => {
  return new Date().toISOString();
};

const logWithTime = (message) => {
  console.log(`[${getCurrentUTC()}] ${message}`);
};

async function getCryptoById(id) {
  try {
    const response = await axios.get(`${API_BASE_URL}/crypto/id/${id}`, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createCrypto(cryptoData) {
  const payload = {
    id: cryptoData.id,
    symbol: cryptoData.symbol,
    name: cryptoData.name,
    image: cryptoData.image || '',
    current_price: cryptoData.current_price,
    market_cap: cryptoData.market_cap,
    market_cap_rank: cryptoData.market_cap_rank,
    fully_diluted_valuation: cryptoData.fully_diluted_valuation,
    total_volume: cryptoData.total_volume,
    high_24h: cryptoData.high_24h,
    low_24h: cryptoData.low_24h,
    price_change_24h: cryptoData.price_change_24h,
    price_change_percentage_24h: cryptoData.price_change_percentage_24h,
    market_cap_change_24h: cryptoData.market_cap_change_24h,
    market_cap_change_percentage_24h:
      cryptoData.market_cap_change_percentage_24h,
  };

  const response = await axios.post(`${API_BASE_URL}/crypto`, payload, {
    timeout: REQUEST_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

async function updateCryptoById(id, cryptoData) {
  const payload = {
    id: cryptoData.id,
    name: cryptoData.name,
    image: cryptoData.image || '',
    current_price: cryptoData.current_price,
    market_cap: cryptoData.market_cap,
    market_cap_rank: cryptoData.market_cap_rank,
    fully_diluted_valuation: cryptoData.fully_diluted_valuation,
    total_volume: cryptoData.total_volume,
    high_24h: cryptoData.high_24h,
    low_24h: cryptoData.low_24h,
    price_change_24h: cryptoData.price_change_24h,
    price_change_percentage_24h: cryptoData.price_change_percentage_24h,
    market_cap_change_24h: cryptoData.market_cap_change_24h,
    market_cap_change_percentage_24h:
      cryptoData.market_cap_change_percentage_24h,
  };

  const response = await axios.put(`${API_BASE_URL}/crypto/id/${id}`, payload, {
    timeout: REQUEST_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

async function addCryptoHistory(id, price) {
  const payload = {
    price: price,
    date: new Date().toISOString(),
  };

  const response = await axios.post(
    `${API_BASE_URL}/crypto/${id}/history`,
    payload,
    {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return response.data;
}

const processCryptoUpdate = async (data) => {
  const start = Date.now();
  try {
    if (typeof data.current_price !== 'number' || isNaN(data.current_price)) {
      throw new Error(`Invalid current_price: ${data.current_price}`);
    }

    const existingCrypto = await getCryptoById(data.id);

    if (!existingCrypto) {
      await createCrypto(data);
      await addCryptoHistory(data.id, data.current_price);
      logWithTime(
        `  ✅ Created ${data.symbol} (${data.id}) with price ${data.current_price}`,
      );
      return {
        id: data.id,
        symbol: data.symbol,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    const oldPrice = existingCrypto.data.current_price;

    await addCryptoHistory(data.id, oldPrice);
    await updateCryptoById(data.id, {
      id: data.id,
      name: data.name,
      image: data.image,
      current_price: data.current_price,
      price_change_24h: data.price_change_24h,
      price_change_percentage_24h: data.price_change_percentage_24h,
      market_cap_change_24h: data.market_cap_change_24h,
      market_cap_change_percentage_24h: data.market_cap_change_percentage_24h,
      high_24h: data.high_24h,
      low_24h: data.low_24h,
      total_volume: data.total_volume,
      market_cap: data.market_cap,
      market_cap_rank: data.market_cap_rank,
      fully_diluted_valuation: data.fully_diluted_valuation,
    });

    if (oldPrice !== data.current_price) {
      logWithTime(
        `  📝 Updated ${data.symbol} (${data.id}): ${oldPrice} → ${data.current_price} (history saved)`,
      );
    } else {
      logWithTime(
        `  📝 Added history entry for ${data.symbol} (${data.id}): price unchanged at ${data.current_price}`,
      );
    }

    return {
      id: data.id,
      symbol: data.symbol,
      action: 'updated',
      oldPrice: oldPrice,
      newPrice: data.current_price,
      duration: Date.now() - start,
    };
  } catch (error) {
    logWithTime(`  ❌ Failed for ${data.symbol || data.id}: ${error.message}`);
    return {
      id: data.id,
      symbol: data.symbol,
      error: error.response?.data?.message || error.message,
    };
  }
};

const cryptoUpdateJob = cron.schedule(
  '*/10 * * * *',
  async () => {
    console.log(`\n[${getCurrentUTC()}] 🔄 Starting crypto update job...`);

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
      const scrapers = Array.isArray(cryptoSources)
        ? cryptoSources
        : Object.values(cryptoSources);

      const scrapedData = await Promise.all(
        scrapers.filter(Boolean).map((scraper) =>
          scraper().catch((err) => ({
            error: err.message,
          })),
        ),
      );

      const validData = scrapedData.filter(
        (data) => data?.id && !data.error && data.current_price,
      );

      console.log(`📊 Processing ${validData.length} cryptocurrencies...`);

      const results = await Promise.all(validData.map(processCryptoUpdate));

      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      const created = results.filter((r) => r.action === 'created').length;
      const updated = results.filter((r) => r.action === 'updated').length;

      todayStats.successful += successful;
      todayStats.failed += failed;

      results.forEach((r) => {
        if (!r.error) {
          todayStats.details.push({
            id: r.id,
            symbol: r.symbol,
            action: r.action,
            oldPrice: r.oldPrice,
            newPrice: r.newPrice,
            time: getCurrentUTC(),
          });
        } else {
          todayStats.details.push({
            id: r.id,
            symbol: r.symbol,
            error: r.error,
            time: getCurrentUTC(),
          });
        }
      });

      console.log(`[${getCurrentUTC()}] ✅ Job completed:`);
      console.log(`  ✅ Successful: ${successful}`);
      console.log(`  ❌ Failed: ${failed}`);
      console.log(`  📝 Created: ${created}, Updated: ${updated}`);

      results
        .filter((r) => r.error)
        .forEach((failure) => {
          console.error(
            `  ❌ ${failure.symbol || failure.id}: ${failure.error}`,
          );
        });
    } catch (error) {
      console.error(`[${getCurrentUTC()}] ❌ Job failed:`, error.message);
    }
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  },
);

console.log('='.repeat(70));
console.log('🚀 Crypto Scraper Service Started');
console.log('='.repeat(70));
console.log(`🌍 Timezone: ${TIMEZONE}`);
console.log(`🕒 Current time: ${getCurrentUTC()}`);
console.log(`🎯 Target API: ${API_BASE_URL}/crypto`);
console.log(`⚡ Update frequency: Every 10 minutes`);
console.log('='.repeat(70) + '\n');

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down crypto scraper service...');
  cryptoUpdateJob.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down crypto scraper service...');
  cryptoUpdateJob.stop();
  process.exit(0);
});

module.exports = cryptoUpdateJob;
