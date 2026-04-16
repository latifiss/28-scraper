const cron = require('node-cron');
const mongoose = require('mongoose');
const getStockData = require('../scripts/equity/simplywallstr');
const { Profile, Statistics } = require('../models/stocks.model');

const MAX_WAIT_MS = 30000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5000;
const REQUEST_DELAY = 1000;

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

const parseMarketCap = (marketCapStr) => {
  if (!marketCapStr || marketCapStr.toLowerCase() === 'n/a') return 0;

  const str = marketCapStr.trim();
  let numericPart = str.replace(/[^\d.]/g, '');
  const numericValue = parseFloat(numericPart) || 0;

  if (str.includes('GH₵') || str.includes('GHS')) {
    if (str.toLowerCase().includes('b')) {
      return numericValue * 1000000000;
    } else if (str.toLowerCase().includes('m')) {
      return numericValue * 1000000;
    } else if (str.toLowerCase().includes('k')) {
      return numericValue * 1000;
    }
  }

  return numericValue;
};

const parsePercentage = (percentStr) => {
  if (!percentStr || percentStr.toLowerCase() === 'n/a') return 0;

  const str = percentStr.trim();
  const numericPart = str.replace(/[^\d.-]/g, '');
  return parseFloat(numericPart) || 0;
};

const processStockData = async (stockData) => {
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

    const marketCap = parseMarketCap(stockData.marketCap);
    const divYield = parsePercentage(stockData.divYield);
    const oneYearReturn = parsePercentage(stockData['1Y_Return']);
    const fiveDaysReturn = parsePercentage(stockData['7D_Return']);

    const updateData = {
      'key_statistics.market_capitalization': String(marketCap),
      'key_statistics.dividend_yield': divYield,
      'returns.five_days_returns': fiveDaysReturn,
      'returns.one_year_returns': oneYearReturn,
      company_name: company_name || symbol,
      ticker_symbol: symbol,
      last_updated: new Date(),
    };

    const existingStats = await Statistics.findOne({
      company_id,
      ticker_symbol: symbol,
    }).lean();

    if (existingStats) {
      await Statistics.findOneAndUpdate(
        { company_id, ticker_symbol: symbol },
        { $set: updateData },
        { new: true, runValidators: true },
      );

      return {
        symbol,
        company_id,
        company_name: company_name || symbol,
        action: 'updated',
        marketCap,
        divYield,
        fiveDaysReturn,
        oneYearReturn,
        duration: Date.now() - start,
      };
    } else {
      const newStatsData = {
        company_id,
        company_name: company_name || symbol,
        ticker_symbol: symbol,
        key_statistics: {
          market_capitalization: String(marketCap),
          dividend_yield: divYield,
          current_price: '0',
          currency: 'GHS',
        },
        returns: {
          five_days_returns: fiveDaysReturn,
          one_year_returns: oneYearReturn,
        },
        last_updated: new Date(),
      };

      const newStats = new Statistics(newStatsData);
      await newStats.save();

      return {
        symbol,
        company_id,
        company_name: company_name || symbol,
        action: 'created',
        marketCap,
        divYield,
        fiveDaysReturn,
        oneYearReturn,
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

const updateStockFinancials = async () => {
  const runId = Date.now();

  if (!checkConnection()) {
    return;
  }

  const startTime = Date.now();

  try {
    const scrapedData = await withRetry(async () => {
      return await withTimeout(
        getStockData(),
        MAX_WAIT_MS,
        'SimplyWall.st Scraper',
      );
    });

    if (
      !scrapedData ||
      !scrapedData.stocks ||
      scrapedData.stocks.length === 0
    ) {
      return;
    }

    const results = [];
    for (let i = 0; i < scrapedData.stocks.length; i++) {
      const stock = scrapedData.stocks[i];
      const result = await processStockData(stock);
      results.push(result);

      if (i < scrapedData.stocks.length - 1) {
        await delay(REQUEST_DELAY);
      }
    }

    const success = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    const created = results.filter((r) => r.action === 'created');
    const updated = results.filter((r) => r.action === 'updated');

    console.log(
      `💰 SimplyWall.st Update: ${success.length} successful, ${failed.length} failed`,
    );
  } catch (error) {
    console.error('SimplyWall.st update failed:', error.message);
  }
};

const simplywallUpdateJob = cron.schedule('0 1 * * *', updateStockFinancials, {
  scheduled: true,
  timezone: 'UTC',
});

const testSimplywallUpdateJob = cron.schedule(
  '*/10 * * * *',
  updateStockFinancials,
  {
    scheduled: false,
    timezone: 'UTC',
  },
);

const manualSimplywallUpdate = async () => {
  return await updateStockFinancials();
};

process.on('SIGINT', async () => {
  simplywallUpdateJob.stop();
  if (testSimplywallUpdateJob) testSimplywallUpdateJob.stop();
  process.exit(0);
});

module.exports = {
  simplywallUpdateJob,
  testSimplywallUpdateJob,
  manualSimplywallUpdate,
  updateStockFinancials,
  processStockData,
  findCompanyBySymbol,
};
