const cron = require('node-cron');
const mongoose = require('mongoose');
const { scrapeGSEWithPuppeteer } = require('../scripts/equity/gse');
const { Profile, Statistics } = require('../models/stocks.model');
const { PriceHistory } = require('../models/stocks.model');

const MAX_WAIT_MS = 15000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;
const REQUEST_DELAY = 1000;
const MARKET_OPEN_HOURS = {
  start: 9,
  end: 15,
  timezone: 'Africa/Accra',
};

const checkConnection = () => mongoose.connection.readyState === 1;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (
  fn,
  retries = MAX_RETRIES,
  delayMs = BASE_RETRY_DELAY,
) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw new Error(`Failed after ${MAX_RETRIES} retries: ${error.message}`);
    }

    const jitter = Math.floor(Math.random() * 1000);
    const retryAfter = delayMs + jitter;

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

const isMarketOpen = () => {
  const now = new Date();
  const accraTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Africa/Accra' }),
  );
  const day = accraTime.getDay();
  const hour = accraTime.getHours();

  const isWeekday = day >= 1 && day <= 5;
  const isMarketHour =
    hour >= MARKET_OPEN_HOURS.start && hour < MARKET_OPEN_HOURS.end;

  return isWeekday && isMarketHour;
};

const findCompanyBySymbol = async (symbol) => {
  try {
    const profile = await Profile.findOne({
      'about.ticker_symbol': symbol,
    })
      .select('company_id about.company_name about.ticker_symbol')
      .lean();

    if (profile) {
      return {
        company_id: profile.company_id,
        company_name: profile.about?.company_name,
        ticker_symbol: profile.about?.ticker_symbol,
        source: 'profile',
      };
    }

    const stats = await Statistics.findOne({
      ticker_symbol: symbol,
    })
      .select('company_id company_name ticker_symbol')
      .lean();

    if (stats) {
      return {
        company_id: stats.company_id,
        company_name: stats.company_name,
        ticker_symbol: stats.ticker_symbol,
        source: 'statistics',
      };
    }

    return null;
  } catch (error) {
    return null;
  }
};

const processPriceHistoryUpdate = async (stockData) => {
  const start = Date.now();
  const { symbol } = stockData;

  try {
    const company = await findCompanyBySymbol(symbol);

    if (!company) {
      return {
        symbol,
        action: 'skipped',
        reason: 'company_not_found',
        duration: Date.now() - start,
      };
    }

    const { company_id, company_name, ticker_symbol } = company;

    const prepareValue = (value) => {
      if (value === null || value === undefined) return '0';
      if (typeof value === 'number') return String(value);
      return String(value || '0');
    };

    const priceEntry = {
      date: new Date(),
      price: prepareValue(stockData.last_price),
    };

    const existingPriceHistory = await PriceHistory.findOne({
      company_id,
      ticker_symbol: symbol,
    }).lean();

    if (existingPriceHistory) {
      const updatedHistory = await PriceHistory.findOneAndUpdate(
        { company_id, ticker_symbol: symbol },
        {
          $set: {
            company_name: company_name || symbol,
          },
          $push: {
            history: {
              $each: [priceEntry],
              $position: 0,
            },
          },
        },
        { new: true, runValidators: true },
      );

      return {
        symbol,
        company_id,
        company_name: company_name || symbol,
        action: 'updated',
        newPrice: priceEntry.price,
        date: priceEntry.date,
        totalEntries: updatedHistory?.history?.length || 0,
        duration: Date.now() - start,
      };
    } else {
      const newPriceHistory = new PriceHistory({
        company_id,
        company_name: company_name || symbol,
        ticker_symbol: symbol,
        history: [priceEntry],
      });

      await newPriceHistory.save();

      return {
        symbol,
        company_id,
        company_name: company_name || symbol,
        action: 'created',
        newPrice: priceEntry.price,
        date: priceEntry.date,
        totalEntries: 1,
        duration: Date.now() - start,
      };
    }
  } catch (error) {
    return {
      symbol,
      error: error.message,
      duration: Date.now() - start,
    };
  }
};

const updatePriceHistoryData = async () => {
  const runId = Date.now();

  if (!isMarketOpen()) {
    return;
  }

  if (!checkConnection()) {
    return;
  }

  const startTime = Date.now();

  try {
    const scrapedData = await withRetry(async () => {
      return await withTimeout(
        scrapeGSEWithPuppeteer(),
        MAX_WAIT_MS,
        'GSE Market Watch Scraper',
      );
    });

    if (!scrapedData || scrapedData.length === 0) {
      return;
    }

    const results = [];
    for (let i = 0; i < scrapedData.length; i++) {
      const stock = scrapedData[i];
      const result = await processPriceHistoryUpdate(stock);
      results.push(result);

      if (i < scrapedData.length - 1) {
        await delay(REQUEST_DELAY);
      }
    }

    const success = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    const created = results.filter((r) => r.action === 'created');
    const updated = results.filter((r) => r.action === 'updated');
  } catch (error) {}
};

const priceHistoryUpdateJob = cron.schedule(
  '0 10-15 * * 1-5',
  updatePriceHistoryData,
  {
    scheduled: true,
    timezone: 'Africa/Accra',
  },
);

const testPriceHistoryUpdateJob = cron.schedule(
  '*/5 * * * *',
  updatePriceHistoryData,
  {
    scheduled: false,
    timezone: 'Africa/Accra',
  },
);

const manualPriceHistoryUpdate = async () => {
  return await updatePriceHistoryData();
};

process.on('SIGINT', async () => {
  priceHistoryUpdateJob.stop();
  if (testPriceHistoryUpdateJob) testPriceHistoryUpdateJob.stop();
  process.exit(0);
});

module.exports = {
  priceHistoryUpdateJob,
  testPriceHistoryUpdateJob,
  manualPriceHistoryUpdate,
  updatePriceHistoryData,
  processPriceHistoryUpdate,
  findCompanyBySymbol,
  isMarketOpen,
};
