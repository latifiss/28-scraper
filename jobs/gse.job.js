const cron = require('node-cron');
const mongoose = require('mongoose');
const { scrapeGSEWithPuppeteer } = require('../scripts/equity/gse');
const { Profile, Statistics } = require('../models/stocks.model');

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
    console.error(`Scraping error (${retries} retries left):`, error.message);

    if (retries <= 0) {
      throw new Error(`Failed after ${MAX_RETRIES} retries: ${error.message}`);
    }

    const jitter = Math.floor(Math.random() * 1000);
    const retryAfter = delayMs + jitter;

    console.warn(
      `⏳ Retrying in ${(retryAfter / 1000).toFixed(
        2,
      )}s... (${retries} attempts left)`,
    );
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
    console.error(`Error finding company for symbol ${symbol}:`, error.message);
    return null;
  }
};

const processStockUpdate = async (stockData) => {
  const start = Date.now();
  const { symbol } = stockData;

  try {
    const company = await findCompanyBySymbol(symbol);

    if (!company) {
      console.warn(
        `⚠️ No company found for symbol: ${symbol}. Consider adding to Profile first.`,
      );
      return {
        symbol,
        action: 'skipped',
        reason: 'company_not_found',
        duration: Date.now() - start,
      };
    }

    const { company_id, company_name, ticker_symbol } = company;

    console.log(`🔍 Found: ${symbol} → ${company_name} (ID: ${company_id})`);

    const existingStats = await Statistics.findOne({
      company_id,
      ticker_symbol: symbol,
    }).lean();

    const prepareValue = (value) => {
      if (value === null || value === undefined) return '0';
      if (typeof value === 'number') return String(value);
      return String(value || '0');
    };

    const updateData = {
      'key_statistics.current_price': prepareValue(stockData.last_price),
      'key_statistics.bid_price': prepareValue(stockData.bid_price),
      'key_statistics.bid_size': prepareValue(stockData.bid_size),
      'key_statistics.ask_price': prepareValue(stockData.ask_price),
      'key_statistics.ask_size': prepareValue(stockData.ask_size),
      'key_statistics.last_trade_price': prepareValue(stockData.last_price),
      'key_statistics.last_trade_volume': prepareValue(stockData.last_volume),
      'key_statistics.volume': Number(stockData.total_volume) || 0,
      'key_statistics.trade_value': prepareValue(stockData.total_value),
      'key_statistics.open': Number(stockData.open) || 0,
      'key_statistics.high': Number(stockData.high) || 0,
      'key_statistics.low': Number(stockData.low) || 0,
      'key_statistics.close': Number(stockData.close) || 0,
      'key_statistics.percentage_change': Number(stockData.percent_change) || 0,
      'key_statistics.currency': 'GHS',
      'key_statistics.status': isMarketOpen() ? 'open' : 'closed',
      'key_statistics.status_message': isMarketOpen()
        ? 'Market open'
        : 'Market closed',
      company_name: company_name || symbol,
      ticker_symbol: symbol,
      last_updated: new Date(),
    };

    if (existingStats) {
      const updatedStats = await Statistics.findOneAndUpdate(
        { company_id, ticker_symbol: symbol },
        { $set: updateData },
        { new: true, runValidators: true },
      );

      const oldPrice = existingStats.key_statistics?.current_price || '0';
      const newPrice = prepareValue(stockData.last_price);

      return {
        symbol,
        company_id,
        company_name: company_name || symbol,
        action: 'updated',
        oldPrice,
        newPrice,
        change: stockData.change,
        percentChange: stockData.percent_change,
        volume: stockData.total_volume,
        duration: Date.now() - start,
      };
    } else {
      const newStatsData = {
        company_id,
        company_name: company_name || symbol,
        ticker_symbol: symbol,
        key_statistics: {
          current_price: prepareValue(stockData.last_price),
          bid_price: prepareValue(stockData.bid_price),
          bid_size: prepareValue(stockData.bid_size),
          ask_price: prepareValue(stockData.ask_price),
          ask_size: prepareValue(stockData.ask_size),
          last_trade_price: prepareValue(stockData.last_price),
          last_trade_volume: prepareValue(stockData.last_volume),
          volume: Number(stockData.total_volume) || 0,
          trade_value: prepareValue(stockData.total_value),
          open: Number(stockData.open) || 0,
          high: Number(stockData.high) || 0,
          low: Number(stockData.low) || 0,
          close: Number(stockData.close) || 0,
          percentage_change: Number(stockData.percent_change) || 0,
          currency: 'GHS',
          status: isMarketOpen() ? 'open' : 'closed',
          status_message: isMarketOpen() ? 'Market open' : 'Market closed',
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
        newPrice: prepareValue(stockData.last_price),
        volume: stockData.total_volume,
        change: stockData.change,
        percentChange: stockData.percent_change,
        duration: Date.now() - start,
      };
    }
  } catch (error) {
    console.error(`❌ Error processing ${symbol}:`, error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }
    return {
      symbol,
      error: error.message,
      duration: Date.now() - start,
    };
  }
};

const createMissingStatistics = async () => {
  try {
    console.log('🔍 Checking for companies missing Statistics records...');

    const allProfiles = await Profile.find({})
      .select('company_id about.company_name about.ticker_symbol')
      .lean();

    const missingStats = [];

    for (const profile of allProfiles) {
      const symbol = profile.about?.ticker_symbol;
      const company_id = profile.company_id;

      if (!symbol) continue;

      const existingStats = await Statistics.findOne({
        company_id,
        ticker_symbol: symbol,
      });

      if (!existingStats) {
        missingStats.push({
          company_id,
          company_name: profile.about?.company_name,
          ticker_symbol: symbol,
          profile_exists: true,
        });
      }
    }

    if (missingStats.length > 0) {
      console.log(
        `⚠️ Found ${missingStats.length} companies missing Statistics records:`,
      );
      missingStats.forEach((ms) => {
        console.log(
          `   • ${ms.ticker_symbol} - ${ms.company_name} (ID: ${ms.company_id})`,
        );
      });

      const createPromises = missingStats.map(async (company) => {
        try {
          const newStats = new Statistics({
            company_id: company.company_id,
            company_name: company.company_name,
            ticker_symbol: company.ticker_symbol,
            key_statistics: {
              currency: 'GHS',
              status: 'open',
              status_message: 'Market open',
              current_price: '0',
              volume: 0,
            },
            last_updated: new Date(),
          });

          await newStats.save();
          return {
            symbol: company.ticker_symbol,
            company_id: company.company_id,
            action: 'created_basic',
            success: true,
          };
        } catch (error) {
          return {
            symbol: company.ticker_symbol,
            company_id: company.company_id,
            action: 'failed',
            error: error.message,
          };
        }
      });

      const results = await Promise.all(createPromises);
      const success = results.filter((r) => r.success);
      const failed = results.filter((r) => r.error);

      console.log(`✅ Created ${success.length} basic Statistics records`);
      if (failed.length > 0) {
        console.warn(`❌ Failed to create ${failed.length} records`);
      }

      return results;
    } else {
      console.log('✅ All companies in Profile have Statistics records');
      return [];
    }
  } catch (error) {
    console.error('Error creating missing statistics:', error.message);
    return [];
  }
};

const updateStockData = async () => {
  const runId = Date.now();
  console.log(
    `\n📈 --- STOCK UPDATE JOB STARTED (${runId}) ---`,
    new Date().toISOString(),
  );

  if (!isMarketOpen()) {
    console.log(
      `⏸️  Market is closed (Ghana time). Current status: ${
        isMarketOpen() ? 'OPEN' : 'CLOSED'
      }`,
    );
  }

  if (!checkConnection()) {
    console.error('❌ MongoDB not connected. Skipping stock update.');
    return {
      runId,
      status: 'error',
      reason: 'db_not_connected',
      timestamp: new Date().toISOString(),
    };
  }

  const startTime = Date.now();

  try {
    console.log('🔄 Scraping GSE Market Watch data...');

    const scrapedData = await withRetry(async () => {
      return await withTimeout(
        scrapeGSEWithPuppeteer(),
        MAX_WAIT_MS,
        'GSE Market Watch Scraper',
      );
    });

    console.log(
      `✅ Scraped ${scrapedData.length} stocks from GSE Market Watch`,
    );

    if (!scrapedData || scrapedData.length === 0) {
      console.warn(
        '⚠️ No stock data scraped. Possible site changes or network issues.',
      );
      return {
        runId,
        status: 'warning',
        reason: 'no_data_scraped',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }

    await createMissingStatistics();

    console.log(`🔄 Processing ${scrapedData.length} stocks...`);

    const results = [];
    for (let i = 0; i < scrapedData.length; i++) {
      const stock = scrapedData[i];
      console.log(
        `📊 [${i + 1}/${scrapedData.length}] Processing: ${stock.symbol}`,
      );

      const result = await processStockUpdate(stock);
      results.push(result);

      if (i < scrapedData.length - 1) {
        await delay(REQUEST_DELAY);
      }
    }

    const success = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    const created = results.filter((r) => r.action === 'created');
    const updated = results.filter((r) => r.action === 'updated');
    const skipped = results.filter((r) => r.action === 'skipped');

    console.log('\n📊 STOCK UPDATE SUMMARY:');
    console.log('='.repeat(60));

    const symbolStatus = {};
    results.forEach((r) => {
      symbolStatus[r.symbol] = {
        action: r.action,
        price: r.newPrice || r.oldPrice,
        change: r.percentChange,
        error: r.error,
      };
    });

    console.log('Processed Symbols:');
    Object.entries(symbolStatus).forEach(([symbol, data], index) => {
      const status = data.error
        ? '❌'
        : data.action === 'created'
          ? '🆕'
          : data.action === 'updated'
            ? '🔄'
            : data.action === 'skipped'
              ? '⏸️'
              : '❓';
      const changeStr =
        data.change !== undefined
          ? `(${data.change >= 0 ? '+' : ''}${data.change}%)`
          : '';
      console.log(
        `  ${status} ${symbol.padEnd(8)}: ${data.price || 'N/A'} ${changeStr}`,
      );
    });

    console.log('='.repeat(60));

    console.log(`Total Scraped: ${scrapedData.length}`);
    console.log(
      `✅ Success: ${success.length} (${created.length} new, ${updated.length} updated)`,
    );
    console.log(`⏸️  Skipped: ${skipped.length} (company not found)`);
    console.log(`❌ Failed: ${failed.length}`);

    if (updated.length > 0) {
      const topGainers = updated
        .filter((u) => u.percentChange > 0)
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, 3);

      const topLosers = updated
        .filter((u) => u.percentChange < 0)
        .sort((a, b) => a.percentChange - b.percentChange)
        .slice(0, 3);

      if (topGainers.length > 0) {
        console.log('\n📈 Top Gainers:');
        topGainers.forEach((tg) => {
          console.log(
            `  🟢 ${tg.symbol}: +${tg.percentChange?.toFixed(2)}% (${
              tg.oldPrice
            } → ${tg.newPrice})`,
          );
        });
      }

      if (topLosers.length > 0) {
        console.log('\n📉 Top Losers:');
        topLosers.forEach((tl) => {
          console.log(
            `  🔴 ${tl.symbol}: ${tl.percentChange?.toFixed(2)}% (${
              tl.oldPrice
            } → ${tl.newPrice})`,
          );
        });
      }
    }

    console.log('='.repeat(60));
    console.log(
      `⏱️  Update completed in ${((Date.now() - startTime) / 1000).toFixed(
        2,
      )} seconds`,
    );

    return {
      runId,
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      summary: {
        total_scraped: scrapedData.length,
        total_processed: results.length,
        created: created.length,
        updated: updated.length,
        skipped: skipped.length,
        failed: failed.length,
        success: success.length,
      },
      results: results,
    };
  } catch (error) {
    console.error('🔥 Stock update failed:', error.message);
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', error.stack);
    }

    return {
      runId,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  } finally {
    console.log(`✅ --- STOCK UPDATE JOB COMPLETED (${runId}) ---\n`);
  }
};

const stockUpdateJob = cron.schedule('0 10-15 * * 1-5', updateStockData, {
  scheduled: true,
  timezone: 'Africa/Accra',
});

const testUpdateJob = cron.schedule('*/2 * * * *', updateStockData, {
  scheduled: false,
  timezone: 'Africa/Accra',
});

const manualStockUpdate = async () => {
  console.log('🔄 Manually triggering stock update...');
  return await updateStockData();
};

const syncAllCompanies = async () => {
  console.log('🔄 Syncing all companies from Profile to Statistics...');
  const results = await createMissingStatistics();
  return results;
};

process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down stock update job...');
  stockUpdateJob.stop();
  if (testUpdateJob) testUpdateJob.stop();
  console.log('✅ Stock update job stopped');
  process.exit(0);
});

module.exports = {
  stockUpdateJob,
  testUpdateJob,
  manualStockUpdate,
  updateStockData,
  syncAllCompanies,
  isMarketOpen,
  processStockUpdate,
  findCompanyBySymbol,
};
