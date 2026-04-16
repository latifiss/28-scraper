const cron = require('node-cron');
const mongoose = require('mongoose');
const Forex = require('../models/forex.model');
const forexSources = require('../scripts/forexIndex');

const checkConnection = () => mongoose.connection.readyState === 1;
const MAX_WAIT_MS = 5 * 60 * 1000;

const withTimeout = (promise, timeoutMs, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs),
    ),
  ]);
};

const processForexUpdate = async (data) => {
  const start = Date.now();
  try {
    const existing = await Forex.findOne({ code: data.code }).lean();

    if (!existing) {
      await Forex.create({
        ...data,
        price_history: [],
        last_updated: new Date(),
      });
      return {
        code: data.code,
        action: 'created',
        duration: Date.now() - start,
      };
    }

    await Forex.updateOne(
      { code: data.code },
      {
        $set: {
          currentPrice: Number(data.currentPrice),
          percentage_change: Number(data.percentage_change),
          monthly_change: Number(data.monthly_change),
          yearly_change: Number(data.yearly_change),
          last_updated: new Date(),
        },
        $push: {
          price_history: {
            $each: [
              {
                date: new Date(),
                price: Number(existing.currentPrice),
                percentage_change: Number(existing.percentage_change),
              },
            ],
            $position: 0,
          },
        },
      },
    );

    return {
      code: data.code,
      action: 'updated',
      oldPrice: existing.currentPrice,
      newPrice: data.currentPrice,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { code: data.code, error: error.message };
  }
};

const forexUpdateJob = cron.schedule(
  '0 * * * *',
  async () => {
    if (!checkConnection()) {
      return;
    }

    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6) {
      return;
    }

    const startTime = Date.now();

    try {
      const scrapers = Array.isArray(forexSources)
        ? forexSources
        : Object.values(forexSources);

      const scrapedData = await Promise.all(
        scrapers
          .filter(Boolean)
          .map((scraper) =>
            withTimeout(
              scraper(),
              MAX_WAIT_MS,
              scraper.name || 'anonymous',
            ).catch((error) => ({ error: error.message })),
          ),
      );

      const validData = scrapedData.filter((data) => data?.code && !data.error);

      await Promise.all(validData.map(processForexUpdate));
    } catch (error) {}
  },
  {
    scheduled: true,
    timezone: 'UTC',
  },
);

module.exports = forexUpdateJob;
