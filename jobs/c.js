const cron = require('node-cron');
const mongoose = require('mongoose');
const axios = require('axios');
const { Crypto } = require('../models/crypto.model');
const cryptoSources = require('../scripts/cryptoIndex');
const NodeCache = require('node-cache');

const cryptoCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

const checkConnection = () => mongoose.connection.readyState === 1;

const MAX_WAIT_MS = 10000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;
const REQUEST_DELAY = 1000;
const USER_AGENT = 'MarketsAPI/1.0 (+https://yourdomain.com/contact)';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (
  fn,
  retries = MAX_RETRIES,
  delayMs = BASE_RETRY_DELAY
) => {
  try {
    return await fn();
  } catch (error) {
    const status = error.response?.status;
    if (status === 429) {
      console.warn('⚠️  Received 429 Too Many Requests from API');
    }
    if (retries <= 0) throw error;

    let retryAfter = error.response?.headers?.['retry-after']
      ? parseInt(error.response.headers['retry-after']) * 1000
      : delayMs;

    const jitter = Math.floor(Math.random() * 1000);
    retryAfter += jitter;

    console.warn(
      `⏳ Retrying in ${(retryAfter / 1000).toFixed(
        2
      )}s... (${retries} attempts left)`
    );
    await delay(retryAfter);
    return withRetry(fn, retries - 1, delayMs * 2);
  }
};

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`⏱️ Timeout: ${label}`)), timeoutMs)
    ),
  ]);

const cachedRequest = async (url, params = {}) => {
  const cacheKey = `${url}:${JSON.stringify(params)}`;
  const cached = cryptoCache.get(cacheKey);
  if (cached) return cached;

  await delay(REQUEST_DELAY);
  const response = await withRetry(() =>
    axios.get(url, {
      params,
      timeout: 5000,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })
  );

  cryptoCache.set(cacheKey, response.data);
  return response.data;
};

const processCryptoUpdate = async (data) => {
  const start = Date.now();
  try {
    const existing = await Crypto.findOne({ id: data.id }).lean();

    if (!existing) {
      await Crypto.create({
        ...data,
        price_history: [],
        last_updated: new Date(),
      });

      return {
        id: data.id,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    await Crypto.updateOne(
      { id: data.id },
      {
        $set: {
          current_price: data.current_price,
          market_cap: data.market_cap,
          market_cap_rank: data.market_cap_rank,
          fully_diluted_valuation: data.fully_diluted_valuation,
          total_volume: data.total_volume,
          high_24h: data.high_24h,
          low_24h: data.low_24h,
          price_change_24h: data.price_change_24h,
          price_change_percentage_24h: data.price_change_percentage_24h,
          market_cap_change_24h: data.market_cap_change_24h,
          market_cap_change_percentage_24h:
            data.market_cap_change_percentage_24h,
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [
              {
                date: new Date(),
                price: existing.current_price,
              },
            ],
            $position: 0,
            $slice: 1000,
          },
        },
      }
    );

    return {
      id: data.id,
      action: 'updated',
      oldPrice: existing.current_price,
      newPrice: data.current_price,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { id: data.id, error: error.message };
  }
};

const cryptoUpdateJob = cron.schedule(
  '*/10 * * * *',
  async () => {
    const runId = Date.now();
    console.log(
      `\n🚀 --- CRON JOB STARTED (${runId}) ---`,
      new Date().toISOString()
    );

    if (!checkConnection()) {
      console.error('❌ MongoDB not connected. Skipping crypto update.');
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(cryptoSources)
        ? cryptoSources
        : Object.values(cryptoSources);

      const scrapedData = await Promise.all(
        scrapers.filter(Boolean).map((scraper) =>
          withTimeout(
            scraper(),
            MAX_WAIT_MS,
            scraper.name || 'anonymous'
          ).catch((err) => ({
            error: err.message,
          }))
        )
      );

      const validData = scrapedData.filter((data) => data?.id && !data.error);
      const errors = scrapedData.filter((data) => data?.error);

      if (errors.length) {
        console.warn(`⚠️  ${errors.length} scrapers failed:`);
        errors.forEach((err) => console.warn(`🔴 ${err.error}`));
      }

      console.log(`🪙 Processing ${validData.length} valid crypto assets...`);

      const results = await Promise.all(validData.map(processCryptoUpdate));
      const success = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);

      success.forEach((result) => {
        console.log(
          `✅ ${result.id.padEnd(10)} ${result.action.padEnd(8)} in ${
            result.duration
          }ms` +
            (result.action === 'updated'
              ? ` 💹 (${result.oldPrice} → ${result.newPrice})`
              : '')
        );
      });

      if (failed.length) {
        console.warn(`❌ ${failed.length} updates failed:`);
        failed.forEach((f) => console.warn(`🔴 ${f.id}: ${f.error}`));
      }

      console.log(
        `\n🎯 Update completed in ${((Date.now() - startTime) / 1000).toFixed(
          2
        )}s | ✅ Success: ${success.length} ❌ Failed: ${
          failed.length + errors.length
        }`
      );
    } catch (error) {
      console.error('🔥 Crypto update failed:', error.message);
    } finally {
      console.log(`✅ --- CRON JOB COMPLETED (${runId}) ---`);
    }
  },
  {
    scheduled: true,
    timezone: 'UTC',
  }
);

process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  cryptoUpdateJob.stop();
  await mongoose.disconnect();
  process.exit(0);
});

module.exports = cryptoUpdateJob;
