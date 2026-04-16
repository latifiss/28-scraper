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
const USER_AGENT = 'MarketsAPI/1.0';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (
  fn,
  retries = MAX_RETRIES,
  delayMs = BASE_RETRY_DELAY,
) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    let retryAfter = error.response?.headers?.['retry-after']
      ? parseInt(error.response.headers['retry-after']) * 1000
      : delayMs;

    const jitter = Math.floor(Math.random() * 1000);
    retryAfter += jitter;

    await delay(retryAfter);
    return withRetry(fn, retries - 1, delayMs * 2);
  }
};

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
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
    }),
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
      },
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
    if (!checkConnection()) {
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
            scraper.name || 'anonymous',
          ).catch((err) => ({
            error: err.message,
          })),
        ),
      );

      const validData = scrapedData.filter((data) => data?.id && !data.error);

      await Promise.all(validData.map(processCryptoUpdate));
    } catch (error) {}
  },
  {
    scheduled: true,
    timezone: 'UTC',
  },
);

process.on('SIGINT', async () => {
  cryptoUpdateJob.stop();
  await mongoose.disconnect();
  process.exit(0);
});

module.exports = cryptoUpdateJob;
